# AI Microservice API Contract & Integration Guide

Tài liệu này định nghĩa giao thức kết nối (API Contract) giữa **NestJS Backend** và **Python AI Microservice (`ai_service`)**.

Dịch vụ `ai_service` đóng vai trò là động cơ xử lý AI độc lập, điều khiển luồng Multi-Agent 5 vòng lặp, tích hợp tìm kiếm minh chứng thời gian thực qua ArXiv API và thực thi các AI Judges phản biện dựa trên mô hình ngôn ngữ lớn `gemini-3.5-flash-lite`.

---

## 1. Tổng Quan Dịch Vụ (Overview)

*   **Base URL (Local):** `http://127.0.0.1:8000`
*   **Swagger Docs (Tương tác trực quan):** `http://127.0.0.1:8000/docs`
*   **Redoc (Tài liệu tĩnh):** `http://127.0.0.1:8000/redoc`

### Cấu hình chế độ Mock dữ liệu
Để chuyển đổi chế độ Mock Data và kết nối Live API, cấu hình biến môi trường trong file `.env` của `ai_service`:
*   `USE_MOCK_AI=True`: Trả về dữ liệu mô phỏng cấu trúc ngay lập tức, không tốn Token và không yêu cầu key thật.
*   `USE_MOCK_AI=False`: Gọi API Gemini và ArXiv thật. Yêu cầu cung cấp `GEMINI_API_KEY` và `GEMINI_MODEL=gemini-3.5-flash-lite`.

---

## 2. Chi Tiết Các API Endpoints (Vòng 1 - Vòng 5)

### Vòng 1 — Nhập Ý Tưởng & Làm Rõ (Clarify & Decompose)

Vòng 1 được tách thành 3 endpoint độc lập (theo `ai-api.md` v2.0):

#### 1a. Hiểu ý tưởng — `POST /ai/v1/clarify/understand`
*   **Mục đích:** Diễn giải lại ý tưởng thô dưới dạng học thuật, tìm các điểm mơ hồ và chấm độ tin cậy.

**Request Body (JSON):**
```json
{
  "idea": "Xây dựng hệ thống Multi-Agent AI giúp phản biện các bài báo khoa học và tự động phát hiện trích dẫn ảo không có thật."
}
```

**Response Body (JSON - 200 OK):**
```json
{
  "clarified_idea": "Hệ thống hóa ý tưởng nghiên cứu về: 'Xây dựng hệ thống Multi-Agent AI giúp phản biện các bài báo khoa học và tự động phát hiện trích dẫn ảo không có thật.' thành các thẻ phân rã có bằng chứng thực tế và cấu trúc kiểm tra tính khả thi.",
  "key_issues": ["Cần xác định baseline rõ ràng", "Cần giới hạn tài nguyên GPU/VRAM"],
  "confidence": 0.85
}
```

#### 1b. Sinh câu hỏi xác nhận — `POST /ai/v1/clarify/questions`
*   **Mục đích:** Sinh 2-3 câu hỏi trắc nghiệm (kèm lựa chọn `Other` ở cuối) để làm rõ giả định, tác vụ và ràng buộc.

**Request Body (JSON):**
```json
{
  "clarified_idea": "Hệ thống hóa ý tưởng nghiên cứu về: 'Xây dựng hệ thống Multi-Agent AI giúp phản biện các bài báo khoa học...'"
}
```

**Response Body (JSON - 200 OK):**
```json
{
  "questions": [
    {
      "question": "Mô hình LLM nào sẽ làm baseline chính cho nghiên cứu này?",
      "example": "Llama-3-8B-Instruct hoặc GPT-4o-mini",
      "options": ["GPT-4o-mini", "Llama-3-8B-Instruct", "Mistral-7B-Instruct", "Other"]
    }
  ]
}
```

#### 1c. Phân rã thành 8 thẻ — `POST /ai/v1/decompose`
*   **Mục đích:** Tách ý tưởng đã làm rõ thành đúng 8 thẻ đặc tả cố định (`PROBLEM`, `RESEARCH_QUESTION`, `GAP_CANDIDATE`, `CONTRIBUTION`, `CLAIM`, `EVIDENCE`, `CONSTRAINT`, `OPEN_QUESTION`), tất cả trạng thái `PROPOSED`.

**Request Body (JSON):**
```json
{
  "idea": "Xây dựng hệ thống Multi-Agent AI giúp phản biện các bài báo khoa học...",
  "clarifiedIdea": "Hệ thống hóa ý tưởng nghiên cứu về: '...'",
  "answers": []
}
```

**Response Body (JSON - 200 OK):**
```json
{
  "cards": [
    {
      "type": "PROBLEM",
      "content": "Đánh giá và hoàn thiện ý tưởng nghiên cứu: Xây dựng hệ thống Multi-Agent AI giúp phản biện các bài báo khoa học và tự động phát hiện trích dẫn ảo không có thật.",
      "status": "PROPOSED"
    },
    {
      "type": "RESEARCH_QUESTION",
      "content": "Làm thế nào để kết hợp Multi-Agent AI System và vòng lặp xác nhận của con người nhằm giảm thiểu citations ảo?",
      "status": "PROPOSED"
    },
    {
      "type": "GAP_CANDIDATE",
      "content": "Các hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token cho việc đánh giá chất lượng spec tự động trên GPU cá nhân.",
      "status": "PROPOSED"
    }
  ]
}
```

---

### Vòng 2 — Nghiên Cứu Liên Quan & Tìm Research Gap
*   **Endpoint:** `POST /ai/v1/related-works`
*   **Mục đích:** Trích xuất từ khóa tìm kiếm tài liệu từ ArXiv, đối sánh related works thực tế (tránh ảo hóa citation) và đề xuất các hướng đi Gap khả thi dạng trắc nghiệm.

#### Request Body (JSON)
```json
{
  "problem": "Các hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token cho việc đánh giá chất lượng spec tự động trên GPU cá nhân.",
  "research_question": "Làm thế nào để kết hợp Multi-Agent AI System và vòng lặp xác nhận của con người nhằm giảm thiểu citations ảo?",
  "keywords": ["multi-agent systems", "hallucination mitigation"]
}
```

#### Response Body (JSON - 200 OK)
```json
{
  "related_works": [
    {
      "paper_title": "Mitigating Hallucinations in Multi-Agent Systems",
      "authors": "John Doe, Jane Smith",
      "year": 2024,
      "what_they_did": "Đề xuất phương pháp đối sánh chéo giữa các tác nhân để giảm sinh thông tin ảo trong bài viết.",
      "feedback": "Cơ chế đối sánh hoạt động tốt nhưng chi phí token quá cao, không khả thi khi chạy trên phần cứng cá nhân.",
      "missing_points": "Chưa nghiên cứu tối ưu hóa tài nguyên phần cứng GPU và phân rã stale-fresh.",
      "source_url": "https://arxiv.org/abs/2401.12345"
    }
  ]
}
```

> **Lưu ý:** Các hướng Research Gap (A/B/C/D) được sinh bởi endpoint riêng `POST /ai/v1/gap-analysis` (trả về `directions`), không nằm trong response của `/related-works`.

---

### Vòng 3 — Contribution, Claim-Evidence & Kế Hoạch Thí Nghiệm
*   **Endpoint:** `POST /ai/v1/spec-experiment`
*   **Mục đích:** Sinh các đóng góp khoa học, thẻ Tuyên bố kèm điều kiện bác bỏ (Claim-Evidence Cards), thiết lập kế hoạch thí nghiệm 5 bước và ước tính tài nguyên phần cứng (VRAM / Token / GPU Time) đảm bảo chạy được trên 1x RTX 3090 (24GB VRAM).

#### Request Body (JSON)
```json
{
  "problem": "Các hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token cho việc đánh giá chất lượng spec tự động trên GPU cá nhân.",
  "gap": "Tối ưu hóa tài nguyên GPU cá nhân (1x RTX 3090) bằng cơ chế Stale-Fresh Invalidation"
}
```

#### Response Body (JSON - 200 OK)
```json
{
  "contributions": [
    "Đề xuất cơ chế Multi-Agent Loop kết hợp phản hồi từ người dùng (Human-in-the-loop) để tối ưu spec.",
    "Thiết kế thuật toán Dependency Invalidation để tránh chạy lại các phần không bị ảnh hưởng."
  ],
  "claims": [
    {
      "claim": "Cơ chế Multi-Agent Loop giúp giảm thiểu 30% citation ảo so với Single-prompt.",
      "baseline": "Single-prompt generation",
      "metric": "Tỷ lệ trích dẫn ảo (Hallucination citation rate)",
      "evidence": "Kết quả đối sánh với paper metadata thực tế từ ArXiv API.",
      "rejection_condition": "Nếu tỷ lệ citation ảo không giảm hoặc tăng lên."
    }
  ],
  "experiments": [
    {
      "name": "TN1: Baseline - Single-prompt",
      "protocol": "Chạy sinh spec bằng single prompt, trích xuất tất cả citation và đối chiếu với cơ sở dữ liệu thật để tính tỷ lệ ảo.",
      "expected_outcome": "Tỷ lệ citation ảo khoảng 25-35%."
    }
  ],
  "feasibility_estimation": {
    "model_name": "Llama-3-8B-Instruct",
    "seed_prompts_count": 10,
    "candidates_count": 3,
    "vram_needed_gb": 16.5,
    "tokens_estimated": 45000,
    "gpu_time_hours": 0.5,
    "is_feasible": true,
    "explanation": "Mô hình Llama-3-8B chạy lượng prompt và candidate ước tính chiếm khoảng 16.5GB VRAM, hoàn toàn nằm trong giới hạn 24GB VRAM của card NVIDIA RTX 3090."
  }
}
```

---

### Vòng 4 — Panel Judge Độc Lập & Phản Biển (Multi-Judge Review)
*   **Endpoint:** `POST /ai/v1/judges/panel`
*   **Mục đích:** Gửi toàn văn bản đặc tả nghiên cứu qua 5 AI Judge đánh giá độc lập (Gap, Contribution, Experiment, Evidence, Conference Readiness). Trả về các Issues phát hiện phân loại theo mức độ (`CRITICAL`, `MAJOR`, `MINOR`).

#### Request Body (JSON)
```json
{
  "problem": "Các hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token cho việc đánh giá chất lượng spec tự động trên GPU cá nhân.",
  "gap": "Tối ưu hóa tài nguyên GPU cá nhân (1x RTX 3090) bằng cơ chế Stale-Fresh Invalidation",
  "related_work": [
    {
      "paper_title": "Mitigating Hallucinations in Multi-Agent Systems",
      "authors": "John Doe, Jane Smith",
      "year": 2024,
      "what_they_did": "Đề xuất phương pháp đối sánh chéo giữa các tác nhân...",
      "feedback": "Cơ chế đối sánh hoạt động tốt nhưng chi phí token quá cao...",
      "missing_points": "Chưa nghiên cứu tối ưu hóa tài nguyên...",
      "source_url": "https://arxiv.org/abs/2401.12345"
    }
  ],
  "contribution": "Đề xuất cơ chế Multi-Agent Loop kết hợp phản hồi từ người dùng.",
  "claims": [
    {
      "claim": "Cơ chế Multi-Agent Loop giúp giảm thiểu 30% citation ảo so với Single-prompt.",
      "baseline": "Single-prompt generation",
      "metric": "Tỷ lệ trích dẫn ảo",
      "evidence": "Kết quả đối sánh thực tế.",
      "rejection_condition": "Tỷ lệ không giảm."
    }
  ],
  "experiments": [
    {
      "name": "TN1: Baseline - Single-prompt",
      "protocol": "Chạy sinh spec bằng single prompt...",
      "expected_outcome": "Tỷ lệ ảo 25-35%."
    }
  ]
}
```

#### Response Body (JSON - 200 OK)
```json
{
  "spec_version_used": 1,
  "status": "PARTIAL_FAILURE",
  "judges": [
    {
      "type": "gap",
      "verdict": "ACCEPT",
      "issues": []
    },
    {
      "type": "contribution",
      "verdict": "REVIEW_REQUIRED",
      "issues": [
        {
          "severity": "MAJOR",
          "description": "Đóng góp nghiên cứu số 1 hơi phóng đại về mặt kết quả đạt được.",
          "suggestion": "Nên diễn đạt lại là 'tính khả thi cao' thay vì khẳng định chắc chắn 100%."
        }
      ]
    },
    {
      "type": "evidence",
      "verdict": "REVIEW_REQUIRED",
      "issues": [
        {
          "severity": "MINOR",
          "description": "Bằng chứng hỗ trợ cho Claim 1 chưa nêu rõ liên kết với nguồn paper metadata nào trong Related Work.",
          "suggestion": "Bổ sung mã định danh ArXiv (e.g. arXiv:2400.00000) vào mô tả bằng chứng."
        }
      ]
    }
  ]
}
```

---

### Vòng 5 — Bản Spec Cuối & Export
*   **Endpoint:** `POST /ai/v1/final-spec`
*   **Mục đích:** Tổng hợp thông tin, lịch sử quyết định để xuất ra file tài liệu Markdown hoàn chỉnh và cấu trúc JSON sạch cho Spec.

#### Request Body (JSON)
```json
{
  "project_title": "Hệ Thống Phản Biện Spec Khả Thi Trên GPU Cá Nhân",
  "problem": "Các hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token...",
  "gap": "Tối ưu hóa tài nguyên GPU cá nhân...",
  "related_work": [],
  "contribution": "Đề xuất cơ chế Multi-Agent...",
  "claims": [],
  "experiments": [],
  "judges_summary": []
}
```

#### Response Body (JSON - 200 OK)
```json
{
  "markdown_content": "# Research Specification: Hệ Thống Phản Biện Spec Khả Thi Trên GPU Cá Nhân\n\n## 1. Problem Statement\nCác hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token...\n...",
  "spec_json": {
    "title": "Hệ Thống Phản Biện Spec Khả Thi Trên GPU Cá Nhân",
    "problem": "Các hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token...",
    "gap": "Tối ưu hóa tài nguyên GPU cá nhân...",
    "contribution": "Đề xuất cơ chế Multi-Agent...",
    "claims": [],
    "experiments": []
  }
}
```

---

## 3. Hướng Dẫn Tích Hợp từ NestJS Backend

Để kết nối NestJS Backend tới Python AI Service, sử dụng thư viện `@nestjs/axios` (Axios wrapper của NestJS) hoặc hàm `fetch` tích hợp sẵn trong Node.js.

### Bước 1: Khai báo HttpClient trong Module
Khai báo `HttpModule` trong `app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // Đặt timeout lớn vì LLM tốn thời gian sinh dữ liệu
      maxRedirects: 5,
    }),
  ],
})
export class AppModule {}
```

### Bước 2: Viết Adapter gọi sang AI Microservice
Thay thế bộ adapter mock nội bộ `LocalLlmAdapter` trong [local.adapters.ts](../../backend/src/integrations/local.adapters.ts) bằng lời gọi HTTP POST thực tế:

```typescript
import { Injectable } from '@nestjs/common';
import { LlmPort, LlmResponse } from './llm.port';

@Injectable()
export class HttpLlmAdapter implements LlmPort {
  private readonly baseUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

  async complete(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse> {
    let endpoint = '/ai/v1/clarify/understand';
    
    // Điều phối Endpoint tương ứng dựa trên tác vụ (task) yêu cầu từ Backend NestJS
    if (task.endsWith('-judge')) {
      endpoint = '/ai/v1/judges/panel';
    } else if (task === 'clarify-questions') {
      endpoint = '/ai/v1/clarify/questions';
    } else if (task === 'decompose') {
      endpoint = '/ai/v1/decompose';
    } else if (task === 'related-works') {
      endpoint = '/ai/v1/related-works';
    } else if (task === 'gap-analysis') {
      endpoint = '/ai/v1/gap-analysis';
    } else if (task === 'spec-experiment') {
      endpoint = '/ai/v1/spec-experiment';
    } else if (task === 'conflicts') {
      endpoint = '/ai/v1/conflicts/check';
    } else if (task === 'final-spec') {
      endpoint = '/ai/v1/final-spec';
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputContext),
      });

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}`);
      }

      const responseData = await response.json();
      
      return {
        output: responseData,
        inputTokens: JSON.stringify(inputContext).length / 4, // Ước tính sơ bộ
        outputTokens: JSON.stringify(responseData).length / 4,
      };
    } catch (error: any) {
      // Chuẩn hóa lỗi theo đặc tả của Hệ thống (để workflow có thể thử lại nếu lỗi tạm thời)
      throw new Error(`[AI Service HTTP Error] ${error.message}`);
    }
  }
}
```

---

## 4. Xử Lý Lỗi & Mã Lỗi (Error Handling)

Dịch vụ AI Microservice trả về mã trạng thái HTTP tiêu chuẩn tương ứng với các tình huống lỗi:

| Mã Lỗi HTTP | Tên Lỗi | Nguyên Nhân | Cách Khắc Phục |
| :--- | :--- | :--- | :--- |
| **`400 Bad Request`** | Bad Request | Dữ liệu đầu vào bị thiếu hoặc rỗng. | Kiểm tra payload gửi sang xem có đúng kiểu string/object không. |
| **`422 Unprocessable Entity`** | Validation Error | Sai cấu trúc JSON Schema (ví dụ: gửi thiếu trường bắt buộc của Pydantic). | Xem chi tiết phản hồi lỗi trả về của FastAPI (chỉ rõ vị trí lỗi `loc` và lý do `msg`) để căn chỉnh lại DTO gửi đi. |
| **`404 Not Found`** | Model Not Found | Khai báo sai định danh mô hình `GEMINI_MODEL`. | Cấu hình lại `GEMINI_MODEL=gemini-3.5-flash-lite` trong `.env`. |
| **`500 Internal Error`** | Internal Server Error | Lỗi cú pháp AI, lỗi từ API bên thứ 3 (Gemini Key bị hết hạn/vượt quá quota). | 1. Đọc log của microservice để kiểm tra.<br>2. NestJS Backend áp dụng cơ chế tự động thử lại (Retry Policy) của Workflow vì đây có thể là lỗi tạm thời (429 Rate Limit). |
