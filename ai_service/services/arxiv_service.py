import arxiv
from typing import List, Dict, Any

class ArxivService:
    def __init__(self):
        # Initialize client
        self.client = arxiv.Client()

    def search_raw_papers(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Search arXiv for papers and return raw details (title, authors, year, summary/abstract, url)
        to feed to the LLM for actual synthesis and analysis.
        """
        try:
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
            return results
        except Exception as e:
            print(f"Error querying arXiv for raw papers: {e}")
            return []

    def search_papers(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Backward compatible mock-synthesis search method.
        """
        try:
            search = arxiv.Search(
                query=query,
                max_results=max_results,
                sort_by=arxiv.SortCriterion.Relevance
            )
            
            results = []
            for r in self.client.results(search):
                authors_str = ", ".join([a.name for a in r.authors])
                results.append({
                    "paper_title": r.title,
                    "authors": authors_str,
                    "year": r.published.year,
                    "what_they_did": f"Đề xuất phương pháp nghiên cứu liên quan đến: {r.summary[:150]}...",
                    "feedback": "Phương pháp tiếp cận tốt nhưng chưa tối ưu hóa tài nguyên chạy thực tế.",
                    "missing_points": "Chưa đánh giá trên các mô hình ngôn ngữ lớn hiện đại và giới hạn tài nguyên GPU.",
                    "source_url": r.entry_id
                })
            return results
        except Exception as e:
            print(f"Error querying arXiv: {e}")
            return [
                {
                    "paper_title": f"Mock Paper on {query}",
                    "authors": "Nguyen Van A, Tran Thi B",
                    "year": 2024,
                    "what_they_did": "Nghiên cứu cơ bản về giải quyết vấn đề sử dụng mô hình học máy.",
                    "feedback": "Bài báo cung cấp nền tảng tốt nhưng chưa có cơ chế Human-in-the-loop.",
                    "missing_points": "Thiếu vòng xác thực độc lập từ các AI Judge.",
                    "source_url": "https://arxiv.org/abs/2400.00000"
                }
            ]
