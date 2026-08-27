export type Question = {
  title: string;
  example: string;
  options: string[];
  selected: number;
};

export const questions: Question[] = [
  {
    title: "Tác vụ chính là gì?",
    example: "Ví dụ: lấy title, method, dataset, kết quả từ paper.",
    options: [
      "Trích xuất thông tin",
      "Trả lời câu hỏi có dẫn nguồn",
      "Tóm tắt tài liệu",
      "Other",
    ],
    selected: 0,
  },
  {
    title: "Bạn muốn spec cuối dùng để làm gì?",
    example: "Ví dụ: đủ rõ để giao cho AI hoặc nhóm dev triển khai.",
    options: ["Làm prototype", "Triển khai thật", "Formal review", "Other"],
    selected: 1,
  },
  {
    title: "Khi thiếu thông tin, hệ thống nên?",
    example: "Ví dụ: hệ thống đề xuất 3 mức quy mô dữ liệu thay vì tự đoán.",
    options: [
      "Dừng và hỏi ngay",
      "Đưa ra lựa chọn để bạn chọn",
      "Tạo giả định tạm thời có cảnh báo",
      "Other",
    ],
    selected: 1,
  },
];

export const DEFAULT_IDEA =
  "Tôi muốn xây dựng phương pháp tự động tối ưu prompt nhiều vòng để giảm hallucination khi LLM trích xuất thông tin từ paper.";

export const IDEA_TAGS = [
  "Nghiên cứu AI",
  "Prompt Optimization",
  "Hallucination",
  "Paper Extraction",
];

export const DEFAULT_UNDERSTANDING =
  "Hệ thống hiểu rằng bạn muốn tạo một vòng lặp tối ưu prompt: sinh nhiều prompt, chạy thử trên cùng tập paper, phát hiện lỗi và tiếp tục cải tiến để giảm thông tin không có bằng chứng trong tài liệu nguồn.";

export const ALTERNATE_UNDERSTANDINGS = [
  "Nói cách khác: bạn muốn xây dựng một vòng lặp tự động chỉnh sửa prompt — mỗi vòng sinh ra vài phiên bản prompt mới, thử nghiệm trên cùng bộ paper, rồi giữ lại phiên bản giúp giảm thông tin bịa đặt (không có trong paper gốc).",
  "Hiểu theo hướng khác: hệ thống sẽ tối ưu prompt qua nhiều vòng lặp có phản hồi — sau mỗi lần chạy thử trích xuất thông tin từ paper, hệ thống đánh giá lỗi hallucination rồi điều chỉnh prompt cho vòng kế tiếp.",
];
