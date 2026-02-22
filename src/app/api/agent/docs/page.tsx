"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function AgentApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI
        url="/api/agent/openapi.yaml"
        docExpansion="list"
        defaultModelsExpandDepth={1}
      />
    </div>
  );
}
