# Graph Report - SymbioKnowledgeBase  (2026-07-15)

## Corpus Check
- 792 files · ~1,303,862 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2265 nodes · 2591 edges · 74 communities detected
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 510 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 131|Community 131]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 82 edges
2. `update()` - 36 edges
3. `resolve()` - 17 edges
4. `CrossReferenceResolver` - 15 edges
5. `SymbioKB` - 13 edges
6. `tiptapToMarkdown()` - 13 edges
7. `text()` - 12 edges
8. `transformExperiment()` - 12 edges
9. `SkbAgentApiWriter` - 12 edges
10. `SymbioKBError` - 11 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `update()`  [INFERRED]
  prisma/reset-demo.ts → src/components/graph/GraphView.tsx
- `main()` --calls--> `update()`  [INFERRED]
  prisma/seed-demo.ts → src/components/graph/GraphView.tsx
- `roundTrip()` --calls--> `markdownToDatabase()`  [INFERRED]
  tests/unit/sync/DatabaseRoundTrip.test.ts → src/lib/sync/DatabaseDeserializer.ts
- `runIncrementalMode()` --calls--> `rebuildAllPageLinks()`  [INFERRED]
  scripts/sync-chemeln.ts → src/lib/wikilinks/indexer.ts
- `runFullBatchMode()` --calls--> `formatIngestionReport()`  [INFERRED]
  scripts/sync-chemeln.ts → src/lib/chemEln/sync/orchestrator.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (66): buildAgentPageTree(), buildFlatList(), computeTreeMeta(), generatePagePath(), isSummaryStale(), checkRateLimit(), pruneIfNeeded(), executeRefresh() (+58 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (49): page(), ChemElnClient, ChemElnRequestError, factorySessionSetup(), globalSetup(), Exception, usePageShares(), usePresence() (+41 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (55): pageToMarkdown(), savePageBlocks(), RateLimiter, createConflictBackup(), hasDatabaseFileChanged(), hasFileChanged(), isFileNotFound(), deserializeCell() (+47 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (27): buildTags(), generateChemicalPage(), generateExperimentPage(), generateReactionTypePage(), generateResearcherPage(), generateSubstrateClassPage(), qualityStars(), statusDisplay() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (20): fetchAndTransformExperiments(), fetchPage(), convertBlock(), getAvailableConversions(), getCurrentBlockType(), formatSyncSummary(), main(), printUsage() (+12 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (44): markdownToTiptap(), processAgentWikilinks(), post(), constantTimeEqual(), findActiveExperiment(), findArchivedExperiment(), findExperimentByElnId(), legacyTitleWhere() (+36 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (31): buildMessages(), streamAnthropic(), streamGoogle(), streamOpenAI(), escapeRegex(), extractFavicon(), extractMetaContent(), isPublicAddress() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (34): sha256Row(), update(), extractBearerToken(), generateApiKey(), hashApiKey(), normalizeScopes(), resolveApiKey(), touchLastUsed() (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (37): makeRouteContext(), makeRouteContext(), block(), makeRouteContext(), nextId(), makeRouteContext(), makeRouteContext(), makeRouteContext() (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (35): isNamespacedTag(), isValidTagFormat(), parseTag(), extractTags(), extractWikilinks(), parseFrontmatterFromMarkdown(), validatePage(), checkEnum() (+27 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (38): buildContextBlocks(), buildSynonymMap(), categoryToEntityType(), classifyIntent(), classifyPageAsBlockType(), executeKbQuery(), extractEntity(), extractRelevantContent() (+30 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (31): getTextContent(), nodeToMarkdown(), tiptapToMarkdown(), classifyConflictType(), detectConflicts(), generateSuggestion(), notifyConflicts(), scanCategoryConflicts() (+23 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (21): aggregateLearningsForReactionType(), classifyLearning(), compareLearnings(), computeTextSimilarity(), confidenceOrder(), deduplicateAndMerge(), extractKeyLearnings(), extractRawLearnings() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (15): getPath(), navigateTo(), waitForApp(), getAncestryFromTree(), usePageTree(), AuthenticationError, ForbiddenError, main() (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.1
Nodes (18): generateChemicalPage(), generateExperimentPage(), generateOneLiner(), generateReactionTypePage(), generateResearcherPage(), generateSubstrateClassPage(), chemicalWikilink(), experimentWikilink() (+10 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (23): astToTiptap(), convertChildren(), convertInlineChildren(), convertInlineNode(), convertNode(), convertTable(), flatMapChildren(), markdownToTiptap() (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (11): useFavoritePages(), useFavorites(), useIsFavorite(), useToggleFavorite(), useToggleFavoriteCallback(), useDeletePage(), FavoriteButton(), getAdjustedPosition() (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (10): useTheme(), useAuthLoading(), useSupabaseClient(), useUser(), cacheKey(), readCache(), ThemeSyncBridge(), writeCache() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (13): clientIpFromHeaders(), logAgentAction(), logAuthEvent(), sanitizeDetails(), createPersonalTenant(), ensureUserExists(), resolveDefaultTenant(), GET() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.32
Nodes (16): bulletList(), bulletListNodes(), callout(), doc(), experimentPage(), extractPlainText(), findingPage(), heading() (+8 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (14): determineScaleCategory(), extractChemicalWikilinks(), formatReagents(), generateElnId(), generateExperimentTitle(), generateTags(), normalizeStatus(), parsePracticalNotes() (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (5): generateTimeAxisHeaders(), getPixelsPerDay(), TimelineView(), useDatabaseRows(), useTableFilters()

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (3): dateToKey(), mapRowsToDays(), CalendarDayCell()

### Community 23 - "Community 23"
Cohesion: 0.35
Nodes (13): boldText(), bulletList(), codeBlock(), divider(), heading(), loadFile(), main(), markdownToTiptap() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (10): buildAggregatorInput(), buildChemicalUsages(), buildExperimentEntries(), buildExperimentRefs(), buildExperimentsWithNotes(), buildExpertiseExperimentInputs(), buildPagesWithTags(), buildResearcherEmails() (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.27
Nodes (13): extractChallenges(), extractDeviations(), extractPracticalNotes(), extractSafetyNotes(), extractTimingTips(), extractWhatWorked(), formatPracticalNotes(), formatTimestamp() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (4): clearPendingRefreshes(), clearClientState(), checkRateLimit(), InMemoryRateLimitStore

### Community 27 - "Community 27"
Cohesion: 0.26
Nodes (4): checkCrossTenantReferences(), getTenantPages(), getTenantWikilinks(), TenantIsolationVerifier

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (9): register(), isPublicPath(), isStaticAsset(), middleware(), assertSupabaseConfiguredInProd(), isDevAuthAllowed(), isSupabaseConfigured(), getGlobalFetchConfig() (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (4): ErrorBoundary, wrap(), renderWithProviders(), renderWithProviders()

### Community 30 - "Community 30"
Cohesion: 0.36
Nodes (4): createAgentClient(), registerResources(), main(), registerTools()

### Community 31 - "Community 31"
Cohesion: 0.2
Nodes (5): useHeadingPositions(), extractHeadings(), useTableOfContents(), TableOfContents(), deduplicateIds()

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (7): clamp(), computeCompletenessScore(), computeConfidence(), computeDocumentationScore(), computeEnhancedQualityScore(), computeReproducibilityScore(), computeYieldScore()

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (3): useAutoSave(), SaveConflictError, useSaveDocument()

### Community 34 - "Community 34"
Cohesion: 0.22
Nodes (2): filterByTags(), searchByTags()

### Community 35 - "Community 35"
Cohesion: 0.39
Nodes (7): assertUrlIsFetchable(), BlockedUrlError, isBlockedIp(), isBlockedIpv4(), isBlockedIpv6(), mappedIpv4(), parseIpv4()

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (4): getBaseExtensions(), getTaskListExtensions(), createWikilinkSuggestion(), SharedPageContent()

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (6): getMeetingNotesPrompt(), getSystemPrompt(), pipeSSE(), streamAnthropic(), streamGoogle(), streamOpenAI()

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (2): readFromStorage(), getDefaultSort()

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (2): NotificationsSection(), useNotificationSettings()

### Community 45 - "Community 45"
Cohesion: 0.43
Nodes (5): ImageInsertDialog(), isSafeUrl(), sanitizeAttrs(), sanitizeNode(), sanitizeTiptapDoc()

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (2): extractFrontmatterBlock(), parseFrontmatterFields()

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (2): getSnapshot(), readFromStorage()

### Community 49 - "Community 49"
Cohesion: 0.29
Nodes (2): useCreateTeamspace(), CreateTeamModal()

### Community 50 - "Community 50"
Cohesion: 0.43
Nodes (4): buildRecentExperiments(), computePrimaryExpertise(), extractResearchers(), resolveResearcherKey()

### Community 51 - "Community 51"
Cohesion: 0.48
Nodes (5): computeHunks(), computeLCS(), countBefore(), generateDiff(), simpleLCS()

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (3): call(), req(), withAgentAuth()

### Community 53 - "Community 53"
Cohesion: 0.4
Nodes (2): flattenTreeIds(), getAllDescendantIds()

### Community 54 - "Community 54"
Cohesion: 0.53
Nodes (4): createDeps(), createMockChemElnClient(), createMockResolver(), createMockWriter()

### Community 55 - "Community 55"
Cohesion: 0.4
Nodes (2): extractFrontmatter(), hasFrontmatterField()

### Community 56 - "Community 56"
Cohesion: 0.4
Nodes (2): agentRequest(), agentUrl()

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (3): useAttachmentUpload(), useToast(), PageCreationMenu()

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (3): useHotkeys(), EnhancedSearchWrapper(), QuickSwitcher()

### Community 62 - "Community 62"
Cohesion: 0.6
Nodes (5): calculateConfidence(), discoverUnlinkedReferences(), escapeRegex(), extractContext(), linkDiscoveryProcessor()

### Community 65 - "Community 65"
Cohesion: 0.5
Nodes (3): CardCover(), isImageUrl(), titleToGradient()

### Community 66 - "Community 66"
Cohesion: 0.4
Nodes (2): useBacklinks(), BacklinksPanel()

### Community 67 - "Community 67"
Cohesion: 0.4
Nodes (2): AIChatButton(), useHydrated()

### Community 70 - "Community 70"
Cohesion: 0.6
Nodes (3): getRequiredEnv(), isMissingOrPlaceholder(), requireInProduction()

### Community 72 - "Community 72"
Cohesion: 0.5
Nodes (1): TokenBucketRateLimiter

### Community 73 - "Community 73"
Cohesion: 0.5
Nodes (2): enhancedSearchBlocks(), ftsSearch()

### Community 75 - "Community 75"
Cohesion: 0.5
Nodes (2): parseCSVLines(), parseCSVToDatabase()

### Community 76 - "Community 76"
Cohesion: 0.5
Nodes (2): extractMentions(), triggerPageMentionNotifications()

### Community 81 - "Community 81"
Cohesion: 0.83
Nodes (3): checkDatabase(), checkSupabase(), GET()

### Community 85 - "Community 85"
Cohesion: 0.67
Nodes (2): handleKeyDown(), handleSubmit()

### Community 89 - "Community 89"
Cohesion: 0.83
Nodes (3): makeEmptyNotes(), makeExperiment(), makeNotesWithTips()

### Community 94 - "Community 94"
Cohesion: 0.5
Nodes (2): useDebounce(), useSearchSuggestions()

### Community 95 - "Community 95"
Cohesion: 0.67
Nodes (2): useClientValue(), useIsMac()

### Community 99 - "Community 99"
Cohesion: 1.0
Nodes (2): getAllDescendantIds(), main()

### Community 101 - "Community 101"
Cohesion: 1.0
Nodes (2): generateMetadata(), getShareLink()

### Community 102 - "Community 102"
Cohesion: 0.67
Nodes (1): GET()

### Community 109 - "Community 109"
Cohesion: 1.0
Nodes (2): nameToHue(), WorkspaceAvatar()

### Community 118 - "Community 118"
Cohesion: 0.67
Nodes (1): MockIncrementalSyncRunner

### Community 130 - "Community 130"
Cohesion: 1.0
Nodes (2): isDestructiveGateEnabled(), requireDestructivePermission()

### Community 131 - "Community 131"
Cohesion: 1.0
Nodes (2): computeNextUntitledTitle(), generateUniqueUntitledTitle()

## Knowledge Gaps
- **21 isolated node(s):** `SymbioKnowledgeBase Agent API — Python Client  A production-ready client for the`, `Base exception for all SymbioKB client errors.`, `Raised when the API key is missing, invalid, or revoked (HTTP 401).`, `Raised when the API key lacks the required scope (HTTP 403).`, `Raised when the requested resource does not exist (HTTP 404).` (+16 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 34`** (9 nodes): `extractTagsFromFrontmatter()`, `filterByTags()`, `matchesTag()`, `computeScore()`, `findMatchedTags()`, `parseTagQuery()`, `searchByTags()`, `tagFilter.ts`, `tagSearch.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (8 nodes): `readFromStorage()`, `useCategorySortPreference()`, `extractElnNumber()`, `getCategoryKey()`, `getDefaultSort()`, `sortPageTreeNodes()`, `useCategorySortPreference.ts`, `sortPages.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (7 nodes): `getStoredSettings()`, `NotificationGroup()`, `NotificationsSection()`, `subscribeToStorage()`, `ToggleRow()`, `useNotificationSettings()`, `NotificationsSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (7 nodes): `buildKnownReferenceSet()`, `extractFrontmatterBlock()`, `extractSections()`, `extractSubsections()`, `extractWikilinks()`, `parseFrontmatterFields()`, `roundTrip.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (7 nodes): `getServerSnapshot()`, `getSnapshot()`, `readFromStorage()`, `subscribe()`, `useRecentPages()`, `writeToStorage()`, `useRecentPages.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (7 nodes): `createTeamspace()`, `fetchTeamspaces()`, `useCreateTeamspace()`, `useTeamspaces()`, `CreateTeamModal()`, `CreateTeamModal.tsx`, `useTeamspaces.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (6 nodes): `DndSidebarTree.tsx`, `findNodeWithParent()`, `flattenTreeIds()`, `getAllDescendantIds()`, `hybridCollision()`, `isDescendantInTree()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (6 nodes): `extractFrontmatter()`, `hasFrontmatterField()`, `hasSection()`, `hasWikilink()`, `isValidFrontmatter()`, `templates.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (6 nodes): `agentRequest()`, `agentUrl()`, `expectError()`, `expectSuccess()`, `isDatabaseAvailable()`, `helpers.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (5 nodes): `useBacklinks()`, `useForwardLinks()`, `BacklinksPanel()`, `BacklinksPanel.tsx`, `useBacklinks.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (5 nodes): `AIChatButton()`, `checkStorageForMessages()`, `useHydrated()`, `AIChatButton.tsx`, `useHydrated.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (5 nodes): `rateLimiter.ts`, `TokenBucketRateLimiter`, `.acquire()`, `.constructor()`, `.refill()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (5 nodes): `enhancedSearchBlocks()`, `ftsSearch()`, `searchBlocks()`, `searchPagesByTitle()`, `query.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (5 nodes): `inferColumnType()`, `parseCSVLines()`, `parseCSVToDatabase()`, `parseValue()`, `csv-import.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (5 nodes): `extractMentions()`, `triggerAgentNotification()`, `triggerPageMentionNotifications()`, `triggerPageUpdateNotifications()`, `triggers.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (4 nodes): `handleCancel()`, `handleKeyDown()`, `handleSubmit()`, `ChatInput.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (4 nodes): `useDebounce()`, `useSearchSuggestions()`, `useDebounce.ts`, `useSearchSuggestions.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (4 nodes): `emptySubscribe()`, `useClientValue()`, `useIsMac()`, `useClientValue.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (3 nodes): `getAllDescendantIds()`, `main()`, `migrate-chemistry-kb-to-team.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 101`** (3 nodes): `page.tsx`, `generateMetadata()`, `getShareLink()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (3 nodes): `GET()`, `route.ts`, `route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 109`** (3 nodes): `WorkspaceAvatar.tsx`, `nameToHue()`, `WorkspaceAvatar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 118`** (3 nodes): `scheduler.test.ts`, `MockIncrementalSyncRunner`, `.runIncrementalSync()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 130`** (3 nodes): `isDestructiveGateEnabled()`, `requireDestructivePermission()`, `requireDestructivePermission.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (3 nodes): `computeNextUntitledTitle()`, `generateUniqueUntitledTitle()`, `generateUniqueTitle.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 18`, `Community 50`, `Community 22`, `Community 26`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `update()` connect `Community 7` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 8`, `Community 10`, `Community 11`, `Community 19`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `POST()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 78 inferred relationships involving `GET()` (e.g. with `._request()` and `.search()`) actually correct?**
  _`GET()` has 78 INFERRED edges - model-reasoned connections that need verification._
- **Are the 35 inferred relationships involving `update()` (e.g. with `main()` and `main()`) actually correct?**
  _`update()` has 35 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `resolve()` (e.g. with `resolveBlockPos()` and `makeRouteContext()`) actually correct?**
  _`resolve()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `SymbioKnowledgeBase Agent API — Python Client  A production-ready client for the`, `Base exception for all SymbioKB client errors.`, `Raised when the API key is missing, invalid, or revoked (HTTP 401).` to the rest of the system?**
  _21 weakly-connected nodes found - possible documentation gaps or missing edges._