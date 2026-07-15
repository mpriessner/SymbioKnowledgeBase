/**
 * DB-backed two-tenant isolation + full-lifecycle tests for AOK-01
 * (Anchored-Object Knowledge). Unlike the mocked route-wiring tests under
 * tests/unit/api/agent/aok/, this file exercises the real service layer,
 * real Prisma queries, and real `resolveApiKey`/`logAgentAction` against a
 * live Postgres — the only way to actually prove cross-tenant isolation
 * (AC-2). Self-skips cleanly when no DATABASE_URL is configured, mirroring
 * tests/api/tenantIsolation.test.ts.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/apiAuth";

import { POST as createAssetPOST } from "@/app/api/agent/aok/assets/route";
import { GET as assetGET, PATCH as assetPATCH } from "@/app/api/agent/aok/assets/[id]/route";
import { GET as searchGET } from "@/app/api/agent/aok/assets/search/route";
import { POST as knowledgePOST } from "@/app/api/agent/aok/assets/[id]/knowledge/route";
import { POST as countsPOST } from "@/app/api/agent/aok/assets/[id]/counts/route";
import { POST as mintPOST } from "@/app/api/agent/aok/anchors/route";
import { POST as bindPOST } from "@/app/api/agent/aok/anchors/[id]/bind/route";
import { GET as resolveGET } from "@/app/api/agent/aok/anchors/resolve/route";
import { DELETE as knowledgeDELETE } from "@/app/api/agent/aok/knowledge/[id]/route";

const HAS_DB = Boolean(process.env.DATABASE_URL);

function req(method: string, url: string, token: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe.skipIf(!HAS_DB)("AOK tenant isolation + lifecycle (DB-backed)", () => {
  let tenantAId: string;
  let tenantBId: string;
  let keyA: string;
  let keyB: string;

  beforeAll(async () => {
    const tenantA = await prisma.tenant.create({ data: { name: "AOK Test Tenant A" } });
    const tenantB = await prisma.tenant.create({ data: { name: "AOK Test Tenant B" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const userA = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenantAId,
        email: "aok-test-a@example.com",
        role: "ADMIN",
      },
    });
    const userB = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenantBId,
        email: "aok-test-b@example.com",
        role: "ADMIN",
      },
    });

    const apiKeyA = generateApiKey();
    const apiKeyB = generateApiKey();
    keyA = apiKeyA.rawKey;
    keyB = apiKeyB.rawKey;

    await prisma.apiKey.create({
      data: {
        tenantId: tenantAId,
        userId: userA.id,
        keyHash: apiKeyA.keyHash,
        keyPrefix: keyA.slice(0, 15),
        name: "AOK Test Key A",
        scopes: ["read", "write"],
      },
    });
    await prisma.apiKey.create({
      data: {
        tenantId: tenantBId,
        userId: userB.id,
        keyHash: apiKeyB.keyHash,
        keyPrefix: keyB.slice(0, 15),
        name: "AOK Test Key B",
        scopes: ["read", "write"],
      },
    });
  });

  afterAll(async () => {
    // Cascade deletes clean up all Aok* rows + the api key + user under each tenant.
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  test("create asset lazily creates the Default Site, scoped to the tenant", async () => {
    const res = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, { name: "Pump 1", category: "pump" })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.asset.space_path).toEqual(["Default Site"]);

    const site = await prisma.aokSite.findFirst({
      where: { tenantId: tenantAId, name: "Default Site" },
    });
    expect(site).not.toBeNull();
  });

  test("cross-tenant relationship id in site_id is rejected, not leaked (AC-2)", async () => {
    const siteA = await prisma.aokSite.findFirstOrThrow({ where: { tenantId: tenantAId } });

    const res = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyB, {
        name: "Cross-tenant asset",
        category: "test",
        site_id: siteA.id,
      })
    );
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);

    // Nothing was created under tenant B pointing at tenant A's site.
    const leaked = await prisma.aokAsset.findFirst({
      where: { tenantId: tenantBId, siteId: siteA.id },
    });
    expect(leaked).toBeNull();
  });

  test("GET/PATCH a tenant A asset with tenant B's key => 404, no leak, no mutation (AC-2)", async () => {
    const createRes = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, { name: "Secret Valve", category: "valve" })
    );
    const { asset } = await createRes.json();

    const getRes = await assetGET(
      req("GET", `/api/agent/aok/assets/${asset.id}`, keyB),
      ctx(asset.id)
    );
    expect(getRes.status).toBe(404);

    const patchRes = await assetPATCH(
      req("PATCH", `/api/agent/aok/assets/${asset.id}`, keyB, { status: "retired" }),
      ctx(asset.id)
    );
    expect(patchRes.status).toBe(404);

    const stillActive = await prisma.aokAsset.findFirst({ where: { id: asset.id } });
    expect(stillActive?.status).toBe("active");
  });

  test(
    "full anchor lifecycle (AC-3): mint unbound -> resolve(bound:false) -> bind -> " +
      "resolve(bound:true, knowledge attached) -> retire -> resolve(retired-speakable)",
    async () => {
      const assetRes = await createAssetPOST(
        req("POST", "/api/agent/aok/assets", keyA, { name: "Reactor A", category: "reactor" })
      );
      const { asset } = await assetRes.json();

      const mintRes = await mintPOST(req("POST", "/api/agent/aok/anchors", keyA, {}));
      const mintBody = await mintRes.json();
      expect(mintRes.status).toBe(201);
      expect(mintBody.anchor.asset_id).toBeNull();
      expect(mintBody.qr_png_base64.length).toBeGreaterThan(0);

      const resolve1 = await resolveGET(
        req(
          "GET",
          `/api/agent/aok/anchors/resolve?payload=${encodeURIComponent(mintBody.anchor.payload)}`,
          keyA
        )
      );
      expect(await resolve1.json()).toEqual({
        ok: true,
        bound: false,
        anchor_id: mintBody.anchor.id,
      });

      const bindRes = await bindPOST(
        req("POST", `/api/agent/aok/anchors/${mintBody.anchor.id}/bind`, keyA, {
          asset_id: asset.id,
        }),
        ctx(mintBody.anchor.id)
      );
      expect(bindRes.status).toBe(200);

      await knowledgePOST(
        req("POST", `/api/agent/aok/assets/${asset.id}/knowledge`, keyA, {
          text: "Runs hot near valve 3.",
        }),
        ctx(asset.id)
      );

      const resolve2 = await resolveGET(
        req(
          "GET",
          `/api/agent/aok/anchors/resolve?payload=${encodeURIComponent(mintBody.anchor.payload)}`,
          keyA
        )
      );
      const resolve2Body = await resolve2.json();
      expect(resolve2Body.ok).toBe(true);
      expect(resolve2Body.bound).toBe(true);
      expect(resolve2Body.asset.id).toBe(asset.id);
      expect(resolve2Body.knowledge.length).toBe(1);

      await assetPATCH(
        req("PATCH", `/api/agent/aok/assets/${asset.id}`, keyA, { status: "retired" }),
        ctx(asset.id)
      );

      const resolve3 = await resolveGET(
        req(
          "GET",
          `/api/agent/aok/anchors/resolve?payload=${encodeURIComponent(mintBody.anchor.payload)}`,
          keyA
        )
      );
      expect(resolve3.status).toBe(200);
      expect(await resolve3.json()).toEqual({ ok: false, error: "This object was retired." });
    }
  );

  test("mint bound directly with asset_id (AC-3)", async () => {
    const assetRes = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, { name: "Reactor B", category: "reactor" })
    );
    const { asset } = await assetRes.json();

    const mintRes = await mintPOST(
      req("POST", "/api/agent/aok/anchors", keyA, { asset_id: asset.id })
    );
    const mintBody = await mintRes.json();
    expect(mintRes.status).toBe(201);
    expect(mintBody.anchor.asset_id).toBe(asset.id);
  });

  test("cross-tenant anchor payload resolve => 404, not leaked (AC-2)", async () => {
    const mintRes = await mintPOST(req("POST", "/api/agent/aok/anchors", keyA, {}));
    const { anchor } = await mintRes.json();

    const resolveAsB = await resolveGET(
      req(
        "GET",
        `/api/agent/aok/anchors/resolve?payload=${encodeURIComponent(anchor.payload)}`,
        keyB
      )
    );
    expect(resolveAsB.status).toBe(404);
    expect(await resolveAsB.json()).toEqual({
      ok: false,
      error: "This code is not bound to any object.",
    });
  });

  test("binding an anchor to a cross-tenant asset id is rejected, not leaked (AC-2)", async () => {
    const assetRes = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, { name: "Tenant A Asset", category: "misc" })
    );
    const { asset: assetA } = await assetRes.json();

    const mintRes = await mintPOST(req("POST", "/api/agent/aok/anchors", keyB, {}));
    const { anchor } = await mintRes.json();

    const bindRes = await bindPOST(
      req("POST", `/api/agent/aok/anchors/${anchor.id}/bind`, keyB, { asset_id: assetA.id }),
      ctx(anchor.id)
    );
    const body = await bindRes.json();
    expect(bindRes.status).toBe(404);
    expect(body.ok).toBe(false);

    const stillUnbound = await prisma.aokAnchor.findFirst({ where: { id: anchor.id } });
    expect(stillUnbound?.assetId).toBeNull();
  });

  test("search: 'shut off' finds 'Main shut-off valve' (hyphen normalization), ranked first, retired excluded (AC-4)", async () => {
    await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, {
        name: "Main shut-off valve",
        category: "valve",
      })
    );
    await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, {
        name: "Backup shutoff mechanism",
        category: "valve",
      })
    );
    const retiredRes = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, {
        name: "Old shut off valve",
        category: "valve",
      })
    );
    const { asset: retiredAsset } = await retiredRes.json();
    await assetPATCH(
      req("PATCH", `/api/agent/aok/assets/${retiredAsset.id}`, keyA, { status: "retired" }),
      ctx(retiredAsset.id)
    );

    const searchRes = await searchGET(req("GET", "/api/agent/aok/assets/search?q=shut+off", keyA));
    const body = await searchRes.json();

    expect(searchRes.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].asset.name).toBe("Main shut-off valve");
    const names = body.results.map((r: { asset: { name: string } }) => r.asset.name);
    expect(names).not.toContain("Old shut off valve");
  });

  test("empty search result is {ok:true, results:[]} (AC-4)", async () => {
    const res = await searchGET(
      req("GET", "/api/agent/aok/assets/search?q=zzz-nonexistent-zzz", keyA)
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, results: [] });
  });

  test("counts: numeric delta with attributes.expected_qty set; nulls otherwise (AC-5)", async () => {
    const withExpected = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, {
        name: "Reagent bottle",
        category: "reagent",
        attributes: { expected_qty: 10 },
      })
    );
    const { asset: assetWithExpected } = await withExpected.json();

    const countRes = await countsPOST(
      req("POST", `/api/agent/aok/assets/${assetWithExpected.id}/counts`, keyA, { qty: 7 }),
      ctx(assetWithExpected.id)
    );
    const countBody = await countRes.json();
    expect(countRes.status).toBe(201);
    expect(countBody.expected_qty).toBe(10);
    expect(countBody.delta).toBe(-3);
    expect(typeof countBody.delta).toBe("number");

    const withoutExpected = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, { name: "Loose reagent", category: "reagent" })
    );
    const { asset: assetNoExpected } = await withoutExpected.json();

    const countRes2 = await countsPOST(
      req("POST", `/api/agent/aok/assets/${assetNoExpected.id}/counts`, keyA, { qty: 5 }),
      ctx(assetNoExpected.id)
    );
    const countBody2 = await countRes2.json();
    expect(countBody2.expected_qty).toBeNull();
    expect(countBody2.delta).toBeNull();
  });

  test("child write (knowledge) against a retired asset is rejected with a speakable 409", async () => {
    const createRes = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, { name: "Retiring Soon", category: "misc" })
    );
    const { asset } = await createRes.json();
    await assetPATCH(
      req("PATCH", `/api/agent/aok/assets/${asset.id}`, keyA, { status: "retired" }),
      ctx(asset.id)
    );

    const res = await knowledgePOST(
      req("POST", `/api/agent/aok/assets/${asset.id}/knowledge`, keyA, { text: "Too late." }),
      ctx(asset.id)
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "That object is retired." });
  });

  test("undo support: delete knowledge; cross-tenant delete is rejected and leaves the row intact", async () => {
    const createRes = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", keyA, { name: "Undo Test", category: "misc" })
    );
    const { asset } = await createRes.json();
    const knowledgeRes = await knowledgePOST(
      req("POST", `/api/agent/aok/assets/${asset.id}/knowledge`, keyA, { text: "temp note" }),
      ctx(asset.id)
    );
    const { knowledge } = await knowledgeRes.json();

    const crossTenantDelete = await knowledgeDELETE(
      req("DELETE", `/api/agent/aok/knowledge/${knowledge.id}`, keyB),
      ctx(knowledge.id)
    );
    expect(crossTenantDelete.status).toBe(404);

    const stillThere = await prisma.aokKnowledge.findFirst({ where: { id: knowledge.id } });
    expect(stillThere).not.toBeNull();

    const ownDelete = await knowledgeDELETE(
      req("DELETE", `/api/agent/aok/knowledge/${knowledge.id}`, keyA),
      ctx(knowledge.id)
    );
    expect(ownDelete.status).toBe(200);

    const gone = await prisma.aokKnowledge.findFirst({ where: { id: knowledge.id } });
    expect(gone).toBeNull();
  });

  test("auth failures on AOK routes keep the repo-standard envelope (agentAuth tests untouched, AC-6)", async () => {
    const res = await createAssetPOST(
      new NextRequest("http://localhost:3000/api/agent/aok/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No auth", category: "test" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
