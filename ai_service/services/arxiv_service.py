import concurrent.futures
import arxiv
from typing import List, Dict, Any

class ArxivService:
    def __init__(self):
        # Initialize client with fast settings
        self.client = arxiv.Client(
            page_size=5,
            delay_seconds=0.5,
            num_retries=1
        )

    def search_raw_papers(self, query: str, max_results: int = 4, timeout_sec: float = 6.0) -> List[Dict[str, Any]]:
        """
        Search arXiv for papers with a strict 6-second timeout.
        If ArXiv API is slow, unreachable, or fails, returns an empty list immediately
        so the caller can fall back to LLM-guided synthesis without blocking the pipeline.
        """
        def _fetch():
            search = arxiv.Search(
                query=query,
                max_results=max_results,
                sort_by=arxiv.SortCriterion.Relevance
            )
            results = []
            for r in self.client.results(search):
                authors_str = ", ".join([a.name for a in r.authors])
                results.append({
                    "title": r.title,
                    "authors": authors_str,
                    "year": r.published.year,
                    "summary": r.summary,
                    "url": r.entry_id
                })
                if len(results) >= max_results:
                    break
            return results

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_fetch)
                return future.result(timeout=timeout_sec)
        except concurrent.futures.TimeoutError:
            print(f"[Warning] ArXiv API query '{query}' timed out after {timeout_sec}s. Falling back to LLM-guided Related Works synthesis...", flush=True)
            return []
        except Exception as e:
            print(f"[Warning] ArXiv API query error ({e}). Falling back to LLM-guided Related Works synthesis...", flush=True)
            return []

    def search_papers(self, query: str, max_results: int = 5, timeout_sec: float = 6.0) -> List[Dict[str, Any]]:
        """
        Backward compatible mock-synthesis search method with 6s timeout.
        """
        raw_papers = self.search_raw_papers(query=query, max_results=max_results, timeout_sec=timeout_sec)
        if raw_papers:
            results = []
            for r in raw_papers:
                results.append({
                    "paper_title": r["title"],
                    "authors": r["authors"],
                    "year": r["year"],
                    "what_they_did": f"Đề xuất phương pháp nghiên cứu: {r['summary'][:150]}...",
                    "feedback": "Phương pháp tiếp cận tốt nhưng chưa tối ưu hóa tài nguyên chạy thực tế.",
                    "missing_points": "Chưa đánh giá trên các mô hình ngôn ngữ lớn hiện đại và giới hạn tài nguyên GPU.",
                    "source_url": r["url"]
                })
            return results

        # Fallback if no papers retrieved
        return [
            {
                "paper_title": f"OPRO: Optimization by PROmpting",
                "authors": "Yang et al.",
                "year": 2023,
                "what_they_did": "Tối ưu hóa prompt tự động bằng search và scoring dựa trên LLM feedback.",
                "feedback": "Phương pháp tốt nhưng chưa tách claim và chưa kiểm tra evidence độc lập.",
                "missing_points": "Không dùng tín hiệu claim-level.",
                "source_url": "https://arxiv.org/abs/2309.03409"
            }
        ]

