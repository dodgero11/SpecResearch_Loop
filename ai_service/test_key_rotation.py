import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from google.genai.errors import ClientError

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.llm_service import KeyManager, LlmService
from schemas.spec_schemas import (
    ClarifyUnderstandResponse,
    ClarifyQuestionsResponse,
    DecomposeResponse,
    SpecExperimentResponse,
    JudgesPanelResponse,
    FinalSpecResponse
)

class TestKeyRotation(unittest.TestCase):
    def test_key_manager_initialization_multi_key(self):
        """Test that KeyManager parses comma-separated keys properly."""
        raw_keys = ' "AIzaKey1" , AIzaKey2,  AIzaKey3  '
        km = KeyManager(raw_keys=raw_keys)
        self.assertEqual(km.total_keys, 3)
        self.assertEqual(km.api_keys, ["AIzaKey1", "AIzaKey2", "AIzaKey3"])
        self.assertEqual(km.current_key, "AIzaKey1")
        self.assertEqual(km.current_key_index, 0)

    def test_key_manager_rotation_cycle(self):
        """Test rotation cycles through keys 0 -> 1 -> 2 -> 0."""
        km = KeyManager(raw_keys="KeyA,KeyB,KeyC")
        self.assertEqual(km.current_key, "KeyA")
        
        # Rotate 1
        self.assertTrue(km.rotate_to_next_key())
        self.assertEqual(km.current_key_index, 1)
        self.assertEqual(km.current_key, "KeyB")
        
        # Rotate 2
        self.assertTrue(km.rotate_to_next_key())
        self.assertEqual(km.current_key_index, 2)
        self.assertEqual(km.current_key, "KeyC")
        
        # Rotate 3 -> back to 0
        self.assertTrue(km.rotate_to_next_key())
        self.assertEqual(km.current_key_index, 0)
        self.assertEqual(km.current_key, "KeyA")

    def test_key_manager_backward_compatibility_single_key(self):
        """Test backward compatibility with single key."""
        km = KeyManager(raw_keys="AIzaSingleKey")
        self.assertEqual(km.total_keys, 1)
        self.assertEqual(km.current_key, "AIzaSingleKey")
        self.assertTrue(km.rotate_to_next_key())
        self.assertEqual(km.current_key_index, 0)

    def test_clean_json_text(self):
        """Test stripping markdown fences and extracting raw JSON."""
        llm = LlmService(key_manager=KeyManager(raw_keys="MockKey12345"))
        
        # Markdown fenced
        fenced_input = "```json\n{\"clarified_idea\": \"Test Idea\", \"key_issues\": [], \"confidence\": 0.9}\n```"
        cleaned = llm._clean_json_text(fenced_input)
        self.assertEqual(cleaned, '{"clarified_idea": "Test Idea", "key_issues": [], "confidence": 0.9}')
        
        # Extra text outside json
        noisy_input = "Here is the result:\n```\n[1, 2, 3]\n```\nHope it helps!"
        cleaned_list = llm._clean_json_text(noisy_input)
        self.assertEqual(cleaned_list, '[1, 2, 3]')

    def test_auto_rotate_on_429_quota_error(self):
        """
        Simulate Key 0 throwing 429 RESOURCE_EXHAUSTED.
        Verify that LLMService catches it, rotates to Key 1, and succeeds.
        """
        km = KeyManager(raw_keys="MockKey0_Throws429,MockKey1_Succeeds")
        llm = LlmService(key_manager=km)
        
        # Setup mock client behavior
        client_key0 = MagicMock()
        client_key0.models.generate_content.side_effect = Exception("429 RESOURCE_EXHAUSTED quota exceeded for free tier")
        
        client_key1 = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '{"clarified_idea": "Success with Key 1", "key_issues": ["Issue 1", "Issue 2"], "confidence": 0.95}'
        client_key1.models.generate_content.return_value = mock_response

        def fake_client_factory(api_key=None, *args, **kwargs):
            if api_key == "MockKey0_Throws429":
                return client_key0
            elif api_key == "MockKey1_Succeeds":
                return client_key1
            return client_key0

        with patch("services.llm_service.genai.Client", side_effect=fake_client_factory):
            llm._init_client()
            result = llm.call_gemini_structured("Test prompt", ClarifyUnderstandResponse)
            
            # Key 0 should have failed with 429 and rotated to Key 1
            self.assertEqual(llm.current_key_index, 1)
            self.assertIsInstance(result, ClarifyUnderstandResponse)
            self.assertEqual(result.clarified_idea, "Success with Key 1")
            self.assertEqual(result.confidence, 0.95)

    def test_safety_fallback_when_all_keys_hit_429(self):
        """
        Simulate all keys throwing 429.
        Verify that LLMService safely returns schema-valid mock data without raising exceptions or crashing.
        """
        km = KeyManager(raw_keys="Key1_429,Key2_429")
        llm = LlmService(key_manager=km)
        
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception("429 Quota Exceeded: RESOURCE_EXHAUSTED")
        llm.client = mock_client
        
        with patch.object(llm, "_init_client"):
            result = llm.call_gemini_structured(
                prompt="Test prompt",
                response_schema=ClarifyUnderstandResponse,
                context={"idea": "Nghiên cứu tối ưu hóa mô hình"}
            )
            
            self.assertIsInstance(result, ClarifyUnderstandResponse)
            self.assertTrue(len(result.clarified_idea) > 0)
            self.assertTrue(len(result.key_issues) >= 2)
            self.assertEqual(result.confidence, 0.85)

    def test_safety_fallback_all_schemas(self):
        """Verify fallback returns valid pydantic objects for core schemas."""
        llm = LlmService(key_manager=KeyManager(raw_keys=""))
        
        for schema in [
            ClarifyUnderstandResponse,
            ClarifyQuestionsResponse,
            DecomposeResponse,
            SpecExperimentResponse,
            JudgesPanelResponse,
            FinalSpecResponse
        ]:
            res = llm._get_fallback_mock_data(schema)
            self.assertIsInstance(res, schema)

if __name__ == "__main__":
    unittest.main()
