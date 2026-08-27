"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Header } from "@/components/research-loop/header";
import { KeywordPanel } from "./keyword-panel";
import { SourcesPanel } from "./sources-panel";
import { RelatedTable } from "./related-table";
import { GapPanel } from "./gap-panel";
import { ConflictPanel } from "./conflict-panel";
import { ProgressSummary } from "./progress-summary";
import {
  DEFAULT_KEYWORDS,
  PRIORITY_SOURCES,
  relatedWorks,
  type RelatedWork,
  type SourceType,
} from "./data";

const MAX_KEYWORDS = 10;

function filterByKeywords(base: RelatedWork[], searchTerms: string[]) {
  const words = searchTerms
    .flatMap((keyword) => keyword.toLowerCase().split(/\s+/))
    .filter(Boolean);
  if (words.length === 0) return base;
  return base.filter((work) => {
    const haystack =
      `${work.name} ${work.whatItDid} ${work.feedbackType} ${work.missingGap}`.toLowerCase();
    return words.some((word) => haystack.includes(word));
  });
}

export default function StepThree() {
  const [allWorks, setAllWorks] = useState(relatedWorks);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [results, setResults] = useState(relatedWorks);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(true);
  const [activeSources, setActiveSources] = useState<SourceType[]>(
    PRIORITY_SOURCES.map((source) => source.key),
  );
  const [hasDirectionSelected, setHasDirectionSelected] = useState(false);
  const [conflictResolved, setConflictResolved] = useState(false);

  const visibleResults = results.filter((work) =>
    activeSources.includes(work.sourceType),
  );

  function handleSearch(searchTerms: string[]) {
    setSearching(true);
    setTimeout(() => {
      setResults(filterByKeywords(allWorks, searchTerms));
      setSearching(false);
      setHasSearched(true);
    }, 1000);

    setKeywords((prev) => {
      const merged = [...prev];
      searchTerms.forEach((term) => {
        if (!merged.includes(term)) merged.push(term);
      });
      return merged.slice(-MAX_KEYWORDS);
    });
  }

  function handleRemoveKeyword(keyword: string) {
    setKeywords((prev) => prev.filter((item) => item !== keyword));
  }

  function handleToggleSource(source: SourceType) {
    setActiveSources((prev) =>
      prev.includes(source)
        ? prev.filter((item) => item !== source)
        : [...prev, source],
    );
  }

  function handleAddWork(work: RelatedWork) {
    setAllWorks((prev) => [...prev, work]);
    setResults((prev) => [...prev, work]);
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="related-research">
        <div className="page-heading">
          <span className="hero-icon">
            <Search size={42} />
          </span>
          <div>
            <h1>
              <span>3.</span> Nghiên cứu liên quan &amp; tìm Research Gap
            </h1>
            <p>
              Đối sánh các công trình liên quan, rút ra khoảng trống nghiên cứu
              và các hướng khả thi.
            </p>
          </div>
        </div>

        <div className="related-grid">
          <section className="research-sidebar">
            <KeywordPanel
              keywords={keywords}
              searching={searching}
              onSearch={handleSearch}
              onRemoveKeyword={handleRemoveKeyword}
            />
            <SourcesPanel
              activeSources={activeSources}
              onToggle={handleToggleSource}
            />
          </section>
          <RelatedTable
            results={visibleResults}
            searching={searching}
            hasSearched={hasSearched}
            onAddWork={handleAddWork}
          />
          <GapPanel
            results={visibleResults}
            onSelectionChange={setHasDirectionSelected}
          />
        </div>

        <ConflictPanel results={visibleResults} onResolvedChange={setConflictResolved} />

        <ProgressSummary
          hasResults={visibleResults.length > 0}
          hasDirection={hasDirectionSelected}
          hasConflictResolved={conflictResolved}
        />

        <Link href="/step-2" className="back-link">
          ← Quay lại bước 2
        </Link>
      </main>
    </div>
  );
}
