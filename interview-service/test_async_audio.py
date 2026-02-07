"""
Test Script for Async Audio Processing
Tests the new GridFS + background transcription implementation
"""

import requests
import time
import json
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000"
TOKEN = "your_jwt_token_here"  # Replace with actual JWT token

# Headers
headers = {
    "Authorization": f"Bearer {TOKEN}"
}


def test_upload_audio(session_id: str, question_id: str, audio_file_path: str):
    """
    Test audio upload endpoint
    Should return immediately with status "processing"
    """
    print(f"\n{'='*60}")
    print("TEST 1: Upload Audio (Non-Blocking)")
    print(f"{'='*60}")
    
    url = f"{BASE_URL}/api/upload-answer/{session_id}/{question_id}"
    
    # Create a test audio file if it doesn't exist
    if not Path(audio_file_path).exists():
        print(f"⚠️  Audio file not found: {audio_file_path}")
        print("Creating dummy audio file for testing...")
        with open(audio_file_path, "wb") as f:
            # Create a minimal valid WebM file (just for testing)
            f.write(b"\x1a\x45\xdf\xa3" + b"\x00" * 100)
    
    with open(audio_file_path, "rb") as audio_file:
        files = {"audio": ("test_answer.webm", audio_file, "audio/webm")}
        
        start_time = time.time()
        response = requests.post(url, headers=headers, files=files)
        elapsed = time.time() - start_time
        
        print(f"\n📊 Results:")
        print(f"  Status Code: {response.status_code}")
        print(f"  Response Time: {elapsed:.2f}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  Response: {json.dumps(data, indent=2)}")
            
            if elapsed < 3.0:
                print(f"  ✅ PASS: Response time < 3s (non-blocking)")
            else:
                print(f"  ❌ FAIL: Response time >= 3s (still blocking?)")
            
            if data.get("status") == "processing":
                print(f"  ✅ PASS: Status is 'processing'")
            else:
                print(f"  ❌ FAIL: Status is not 'processing'")
            
            return data.get("file_id")
        else:
            print(f"  ❌ FAIL: {response.text}")
            return None


def test_transcription_status(session_id: str, question_id: str):
    """
    Test transcription status endpoint
    Should show status progression: queued → processing → completed
    """
    print(f"\n{'='*60}")
    print("TEST 2: Check Transcription Status")
    print(f"{'='*60}")
    
    url = f"{BASE_URL}/api/transcription-status/{session_id}/{question_id}"
    
    max_checks = 20
    check_interval = 2  # seconds
    
    for i in range(max_checks):
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            
            print(f"\n  Check #{i+1}:")
            print(f"    Status: {status}")
            
            if status == "completed":
                print(f"    Transcript: {data.get('transcript', 'N/A')[:100]}...")
                print(f"  ✅ PASS: Transcription completed")
                return True
            elif status == "failed":
                print(f"    Error: {data.get('error')}")
                print(f"  ❌ FAIL: Transcription failed")
                return False
            elif status in ["queued", "processing"]:
                print(f"    Waiting... (will check again in {check_interval}s)")
                time.sleep(check_interval)
            else:
                print(f"  ⚠️  Unknown status: {status}")
                time.sleep(check_interval)
        else:
            print(f"  ❌ FAIL: {response.text}")
            return False
    
    print(f"  ❌ FAIL: Transcription did not complete within {max_checks * check_interval}s")
    return False


def test_all_transcription_status(session_id: str):
    """
    Test endpoint that shows status for all questions in a session
    """
    print(f"\n{'='*60}")
    print("TEST 3: Check All Transcription Status")
    print(f"{'='*60}")
    
    url = f"{BASE_URL}/api/transcription-status/{session_id}"
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n📊 Results:")
        print(f"  Session ID: {data.get('session_id')}")
        print(f"\n  Summary:")
        summary = data.get('summary', {})
        print(f"    Total: {summary.get('total')}")
        print(f"    Completed: {summary.get('completed')}")
        print(f"    Processing: {summary.get('processing')}")
        print(f"    Queued: {summary.get('queued')}")
        print(f"    Failed: {summary.get('failed')}")
        
        if summary.get('completed') == summary.get('total'):
            print(f"  ✅ PASS: All transcriptions completed")
            return True
        else:
            print(f"  ⚠️  Some transcriptions still pending")
            return False
    else:
        print(f"  ❌ FAIL: {response.text}")
        return False


def test_analyze_with_pending(session_id: str):
    """
    Test analyze endpoint handling of pending transcriptions
    """
    print(f"\n{'='*60}")
    print("TEST 4: Analyze Interview (with retry logic)")
    print(f"{'='*60}")
    
    url = f"{BASE_URL}/api/analyze/{session_id}"
    
    max_retries = 12
    retry_interval = 5  # seconds
    
    for i in range(max_retries):
        print(f"\n  Attempt #{i+1}:")
        
        response = requests.post(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            
            print(f"    Status: {status}")
            
            if status == "success":
                print(f"    Final Score: {data.get('final_score')}")
                print(f"    Scored Count: {data.get('scored_count')}")
                print(f"  ✅ PASS: Analysis completed successfully")
                return True
            elif status == "transcription_pending":
                pending = data.get('pending_count', 0)
                processing = data.get('processing_count', 0)
                print(f"    Waiting for {pending + processing} transcriptions...")
                print(f"    Retrying in {retry_interval}s...")
                time.sleep(retry_interval)
            else:
                print(f"  ⚠️  Unknown status: {status}")
                time.sleep(retry_interval)
        else:
            print(f"  ❌ FAIL: {response.text}")
            return False
    
    print(f"  ❌ FAIL: Analysis did not complete within {max_retries * retry_interval}s")
    return False


def test_gridfs_cleanup():
    """
    Test that audio files are deleted from GridFS after transcription
    This would require direct MongoDB access
    """
    print(f"\n{'='*60}")
    print("TEST 5: GridFS Cleanup (Manual Check)")
    print(f"{'='*60}")
    
    print("\n  To verify audio cleanup:")
    print("  1. Connect to MongoDB:")
    print("     mongo")
    print("  2. Switch to database:")
    print("     use ai_interviewer")
    print("  3. Count GridFS files:")
    print("     db.fs.files.count()")
    print("  4. Expected: Should be 0 or very low (old files)")
    print("\n  ✅ Manual verification required")


def run_all_tests():
    """
    Run all tests
    """
    print("\n" + "="*60)
    print("ASYNC AUDIO PROCESSING TEST SUITE")
    print("="*60)
    
    # Get test parameters
    print("\n📝 Test Configuration:")
    session_id = input("  Enter Session ID (or press Enter for test123): ").strip() or "test123"
    question_id = input("  Enter Question ID (or press Enter for q1): ").strip() or "q1"
    audio_file = input("  Enter audio file path (or press Enter for test_audio.webm): ").strip() or "test_audio.webm"
    
    # Update token
    global TOKEN
    token_input = input(f"  Enter JWT token (or press Enter to use existing): ").strip()
    if token_input:
        TOKEN = token_input
        headers["Authorization"] = f"Bearer {TOKEN}"
    
    print("\n🚀 Starting tests...\n")
    
    # Run tests
    test_results = []
    
    # Test 1: Upload
    file_id = test_upload_audio(session_id, question_id, audio_file)
    test_results.append(("Upload Audio", file_id is not None))
    
    if file_id:
        time.sleep(2)  # Wait a moment before checking status
        
        # Test 2: Individual status
        result = test_transcription_status(session_id, question_id)
        test_results.append(("Transcription Status", result))
        
        # Test 3: All status
        result = test_all_transcription_status(session_id)
        test_results.append(("All Transcription Status", result))
        
        # Test 4: Analyze
        result = test_analyze_with_pending(session_id)
        test_results.append(("Analyze Interview", result))
    
    # Test 5: Manual cleanup check
    test_gridfs_cleanup()
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}\n")
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {test_name}")
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    print(f"\n  Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n  🎉 All tests passed!")
    else:
        print(f"\n  ⚠️  {total - passed} test(s) failed")


if __name__ == "__main__":
    try:
        run_all_tests()
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
