# Hexagonal Architecture Migration - Comprehensive Test Cases

## Executive Summary

This document provides an exhaustive catalog of edge cases, failure scenarios, and boundary conditions that MUST be tested during the hexagonal architecture migration. The current system streams OpenAI chat completions with tool calls, and we must ensure ZERO regression in functionality.

## 1. Edge Case Catalog

### 1.1 Message Conversion Edge Cases (`api/utils/prompt.py`)

#### Empty/Null Scenarios
- **EC-MSG-001**: Empty message list `messages = []`
- **EC-MSG-002**: Message with `None` content field
- **EC-MSG-003**: Message with empty string content `""`
- **EC-MSG-004**: Message array is `None` instead of list
- **EC-MSG-005**: Message without role field

#### Attachment Edge Cases
- **EC-ATT-001**: Mixed attachments (image + text) in single message
- **EC-ATT-002**: Attachment with invalid URL (not http/https)
- **EC-ATT-003**: Attachment with missing `contentType` field
- **EC-ATT-004**: Base64 data URL instead of HTTP URL
- **EC-ATT-005**: Attachment URL returns 404
- **EC-ATT-006**: Extremely large image attachment (>100MB)
- **EC-ATT-007**: Unsupported MIME type (e.g., `application/pdf`)
- **EC-ATT-008**: Malformed base64 encoding in data URL
- **EC-ATT-009**: Relative URL instead of absolute
- **EC-ATT-010**: `contentType` with charset encoding `text/plain; charset=utf-8`

#### Tool Invocation Edge Cases
- **EC-TOOL-001**: Tool invocation without matching `tool_call_id`
- **EC-TOOL-002**: Tool invocation with `None` args
- **EC-TOOL-003**: Tool invocation with `None` result
- **EC-TOOL-004**: Multiple tool invocations in single message
- **EC-TOOL-005**: Tool invocation with invalid state enum
- **EC-TOOL-006**: Circular reference in tool args JSON
- **EC-TOOL-007**: Tool name with special characters
- **EC-TOOL-008**: Tool result exceeding size limits

#### Content Edge Cases
- **EC-CONT-001**: Very long content string (>1MB)
- **EC-CONT-002**: Unicode/emoji in content
- **EC-CONT-003**: Null bytes `\0` in content
- **EC-CONT-004**: Invalid role (not user/assistant/system/tool)
- **EC-CONT-005**: HTML/JavaScript in content (XSS attempt)
- **EC-CONT-006**: Content with ANSI escape codes

### 1.2 Streaming Protocol Edge Cases (`api/index.py:61-142`)

#### Chunk Processing
- **EC-STRM-001**: Empty chunk array `chunk.choices = []`
- **EC-STRM-002**: Chunk with `None` content `choice.delta.content = None`
- **EC-STRM-003**: Partial tool call arguments split across chunks
- **EC-STRM-004**: Malformed JSON in tool arguments
- **EC-STRM-005**: Chunk without choices field
- **EC-STRM-006**: Multiple finish_reason in single chunk
- **EC-STRM-007**: Unknown finish_reason value
- **EC-STRM-008**: Chunk with both content and tool_calls

#### Stream State Management
- **EC-STATE-001**: Tool call without ID field
- **EC-STATE-002**: Tool call without name field
- **EC-STATE-003**: Draft tool calls index out of bounds
- **EC-STATE-004**: Duplicate tool call IDs
- **EC-STATE-005**: Tool arguments never complete (missing closing brace)
- **EC-STATE-006**: Stream ends without finish event

#### Protocol Format
- **EC-PROT-001**: Missing usage stats in final chunk
- **EC-PROT-002**: Usage stats with negative values
- **EC-PROT-003**: Finish reason mismatch (has tools but reason="stop")
- **EC-PROT-004**: Invalid JSON escaping in format codes
- **EC-PROT-005**: Line breaks within formatted output

### 1.3 Tool Execution Edge Cases

#### Execution Failures
- **EC-EXEC-001**: Tool not found in `available_tools` dictionary
- **EC-EXEC-002**: Tool function throws exception
- **EC-EXEC-003**: Tool returns `None` instead of valid result
- **EC-EXEC-004**: Tool returns invalid JSON structure
- **EC-EXEC-005**: Tool execution timeout (>30s)
- **EC-EXEC-006**: Tool modifies global state
- **EC-EXEC-007**: Recursive tool calls (A→B→A)

#### Argument Validation
- **EC-ARG-001**: Missing required arguments (lat/lon)
- **EC-ARG-002**: Wrong type (string instead of number)
- **EC-ARG-003**: Out of range values (lat > 90)
- **EC-ARG-004**: NaN or Infinity values
- **EC-ARG-005**: Extra unexpected arguments
- **EC-ARG-006**: Nested object when expecting primitive

#### Weather API Specific
- **EC-WTHR-001**: Invalid coordinates (lat=200, lon=500)
- **EC-WTHR-002**: Open-Meteo API returns 429 (rate limit)
- **EC-WTHR-003**: Open-Meteo API timeout
- **EC-WTHR-004**: Malformed API response
- **EC-WTHR-005**: API returns HTML error page
- **EC-WTHR-006**: Network DNS resolution failure

### 1.4 OpenAI API Edge Cases

#### Authentication/Authorization
- **EC-OAPI-001**: API key is `None` or empty string
- **EC-OAPI-002**: Invalid API key format
- **EC-OAPI-003**: Expired/revoked API key (401)
- **EC-OAPI-004**: Insufficient permissions (403)

#### Rate Limiting/Quotas
- **EC-OAPI-005**: Rate limit exceeded (429)
- **EC-OAPI-006**: Token limit exceeded (400)
- **EC-OAPI-007**: Context window overflow
- **EC-OAPI-008**: Quota exhausted

#### Service Issues
- **EC-OAPI-009**: Model not found (404)
- **EC-OAPI-010**: Service unavailable (503)
- **EC-OAPI-011**: Gateway timeout (504)
- **EC-OAPI-012**: Connection timeout
- **EC-OAPI-013**: SSL certificate error
- **EC-OAPI-014**: Malformed streaming response

### 1.5 Concurrent Request Edge Cases

#### Concurrency Issues
- **EC-CONC-001**: Multiple simultaneous requests to `/api/chat`
- **EC-CONC-002**: Shared OpenAI client thread safety
- **EC-CONC-003**: Tool repository race conditions
- **EC-CONC-004**: Memory pressure from many large streams
- **EC-CONC-005**: Connection pool exhaustion
- **EC-CONC-006**: File descriptor limit reached
- **EC-CONC-007**: Request cancellation mid-stream
- **EC-CONC-008**: Interleaved stream chunks

## 2. Priority Matrix

### Priority 0 (CRITICAL) - System Breaking
Must be tested before production. System fails catastrophically without proper handling.

| Test Case | Description | Impact if Missed |
|-----------|-------------|------------------|
| EC-OAPI-001 | Missing API key | Complete service failure |
| EC-EXEC-002 | Uncaught tool exception | Server crash |
| EC-STRM-004 | Malformed JSON parsing | Request hangs |
| EC-OAPI-006 | Token limit exceeded | Silent truncation |
| EC-STATE-006 | Stream without finish | Frontend hangs |
| EC-MSG-001 | Empty message list | OpenAI API rejection |

### Priority 1 (HIGH) - Feature Breaking
Core features fail but system remains operational.

| Test Case | Description | Impact if Missed |
|-----------|-------------|------------------|
| EC-EXEC-001 | Tool not found | Tool calls fail |
| EC-WTHR-002 | Weather API rate limit | Weather unavailable |
| EC-ATT-002 | Invalid attachment URL | Attachments ignored |
| EC-ARG-003 | Invalid coordinates | Tool errors |
| EC-OAPI-005 | Rate limiting | Service degradation |
| EC-CONC-002 | Thread safety issues | Mixed responses |

### Priority 2 (MEDIUM) - Edge Cases
Less common scenarios but still important.

| Test Case | Description | Impact if Missed |
|-----------|-------------|------------------|
| EC-CONT-002 | Unicode in content | Display issues |
| EC-ATT-006 | Large attachments | Memory issues |
| EC-TOOL-004 | Multiple tool calls | Partial execution |
| EC-MSG-003 | Empty content | Validation errors |
| EC-ATT-007 | Unsupported MIME | File ignored |

### Priority 3 (LOW) - Rare Scenarios
Unlikely but should be documented.

| Test Case | Description | Impact if Missed |
|-----------|-------------|------------------|
| EC-EXEC-007 | Recursive tools | Stack overflow |
| EC-CONT-006 | ANSI escape codes | Display corruption |
| EC-CONC-008 | Interleaved chunks | Garbled output |

## 3. Test Case Templates (Top 10 Critical)

### Test 1: Missing API Key
```python
@pytest.mark.critical
async def test_missing_api_key():
    # Arrange
    with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
        adapter = OpenAILLMAdapter()

    # Act & Assert
    with pytest.raises(AuthenticationError) as exc:
        await adapter.create_completion(messages=[])

    assert "API key" in str(exc.value)
    assert exc.value.status_code == 401
```

### Test 2: Tool Execution Exception
```python
@pytest.mark.critical
async def test_tool_execution_exception():
    # Arrange
    mock_tool = Mock(side_effect=Exception("Network error"))
    tool_repo = InMemoryToolRepository()
    tool_repo.add_tool("failing_tool", mock_tool)

    use_case = ExecuteToolUseCase(tool_repo)

    # Act
    result = await use_case.execute(
        tool_name="failing_tool",
        arguments={"arg": "value"}
    )

    # Assert
    assert result.success is False
    assert "Network error" in result.error_message
    assert result.error_code == "TOOL_EXECUTION_ERROR"
```

### Test 3: Malformed Tool Arguments JSON
```python
@pytest.mark.critical
async def test_malformed_tool_arguments():
    # Arrange
    chunk = StreamChunk(
        tool_calls=[{
            "id": "call_123",
            "function": {
                "name": "get_weather",
                "arguments": '{"lat": 40, "lon"'  # Incomplete JSON
            }
        }]
    )

    # Act
    protocol_adapter = VercelStreamProtocolAdapter()
    result = protocol_adapter.parse_tool_arguments(chunk)

    # Assert
    assert result.is_partial is True
    assert result.needs_more_chunks is True
    # Should accumulate, not fail
```

### Test 4: Token Limit Exceeded
```python
@pytest.mark.critical
async def test_token_limit_exceeded():
    # Arrange
    huge_message = "x" * 200000  # Exceeds token limit
    messages = [Message(role="user", content=huge_message)]

    mock_openai = Mock()
    mock_openai.chat.completions.create.side_effect = \
        BadRequestError("Token limit exceeded")

    adapter = OpenAILLMAdapter(client=mock_openai)

    # Act & Assert
    with pytest.raises(TokenLimitError) as exc:
        await adapter.create_completion(messages)

    assert exc.value.token_count > 128000
    assert exc.value.suggested_action == "truncate"
```

### Test 5: Stream Interruption
```python
@pytest.mark.critical
async def test_stream_interruption():
    # Arrange
    async def interrupted_stream():
        yield {"choices": [{"delta": {"content": "Hello"}}]}
        yield {"choices": [{"delta": {"content": " world"}}]}
        raise ConnectionError("Stream interrupted")

    mock_adapter = Mock()
    mock_adapter.stream_completion.return_value = interrupted_stream()

    # Act
    use_case = StreamChatCompletionUseCase(mock_adapter)
    chunks = []
    error = None

    try:
        async for chunk in use_case.stream(messages=[]):
            chunks.append(chunk)
    except StreamingError as e:
        error = e

    # Assert
    assert len(chunks) == 2
    assert error is not None
    assert "interrupted" in str(error)
```

### Test 6: Empty Message List
```python
@pytest.mark.critical
def test_empty_message_list():
    # Arrange
    messages = []

    # Act
    openai_messages = convert_to_openai_messages(messages)

    # Assert
    assert openai_messages == []
    # Should handle gracefully, OpenAI will reject
```

### Test 7: Tool Not Found
```python
@pytest.mark.critical
async def test_tool_not_found():
    # Arrange
    tool_repo = InMemoryToolRepository()
    # Don't add the tool

    use_case = ExecuteToolUseCase(tool_repo)

    # Act
    result = await use_case.execute(
        tool_name="nonexistent_tool",
        arguments={}
    )

    # Assert
    assert result.success is False
    assert result.error_code == "TOOL_NOT_FOUND"
    assert "nonexistent_tool" in result.error_message
```

### Test 8: Concurrent Requests
```python
@pytest.mark.critical
async def test_concurrent_requests():
    # Arrange
    client = TestClient(app)

    async def make_request(id: int):
        response = await client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": f"Request {id}"}]}
        )
        return response.json()

    # Act
    tasks = [make_request(i) for i in range(10)]
    results = await asyncio.gather(*tasks)

    # Assert
    for i, result in enumerate(results):
        assert f"Request {i}" in str(result)
        assert results.count(result) == 1  # No mixed responses
```

### Test 9: Invalid Attachment URL
```python
@pytest.mark.critical
def test_invalid_attachment_url():
    # Arrange
    message = ClientMessage(
        role="user",
        content="Check this",
        experimental_attachments=[
            ClientAttachment(
                name="file.txt",
                contentType="text/plain",
                url="not-a-valid-url"
            )
        ]
    )

    # Act & Assert
    with pytest.raises(ValidationError) as exc:
        convert_to_openai_messages([message])

    assert "Invalid URL" in str(exc.value)
```

### Test 10: Partial Tool Arguments
```python
@pytest.mark.critical
async def test_partial_tool_arguments_accumulation():
    # Arrange
    chunks = [
        {"tool_calls": [{"id": "1", "function": {"arguments": '{"lat":'}}]},
        {"tool_calls": [{"function": {"arguments": '40.7,'}}]},
        {"tool_calls": [{"function": {"arguments": '"lon":-74.0}'}}]}
    ]

    # Act
    adapter = VercelStreamProtocolAdapter()
    accumulated = adapter.accumulate_tool_args(chunks)

    # Assert
    assert accumulated == {"lat": 40.7, "lon": -74.0}
```

## 4. Regression Risk Assessment

### Critical Regression Risks (Production Breaking)
1. **Tool Execution Failures**: Unhandled exceptions crash the server
2. **Malformed Streaming**: Frontend hangs waiting for completion
3. **Token Limit Handling**: Responses silently truncated
4. **Connection Drops**: Lost conversations, data corruption
5. **Message Conversion Errors**: All requests fail

### High Regression Risks (Feature Breaking)
1. **Attachment Processing**: Files/images not sent to model
2. **Concurrent Requests**: User responses mixed up
3. **Rate Limiting**: Service appears down
4. **Tool Arguments**: Tools fail silently
5. **Usage Stats**: Billing/monitoring broken

### Medium Regression Risks (UX Degradation)
1. **Unicode Handling**: Emoji/special chars corrupted
2. **Large Files**: Memory exhaustion
3. **Error Messages**: Generic errors, poor debugging
4. **Partial Responses**: Incomplete tool results

## 5. Boundary Value Analysis

### Numeric Boundaries

| Parameter | Min Valid | Max Valid | Below Min | Above Max | Special |
|-----------|-----------|-----------|-----------|-----------|---------|
| Latitude | -90 | 90 | -91 | 91 | 0, NaN, ∞ |
| Longitude | -180 | 180 | -181 | 181 | 0, NaN, ∞ |
| Token Count | 1 | 128000 | 0 | 128001 | - |
| Message Count | 1 | 1000 | 0 | 10000 | - |
| String Length | 1 | 1000000 | 0 | 10000000 | null byte |
| File Size | 1B | 100MB | 0B | 1GB | - |
| Attachment Count | 0 | 100 | - | 1000 | - |
| Chunk Size | 1B | 64KB | 0B | 1MB | - |
| Concurrent Reqs | 1 | 100 | - | 1000 | system limit |

### String Boundaries

| Field | Empty | Single Char | Normal | Very Long | Special Cases |
|-------|-------|-------------|---------|-----------|---------------|
| Content | "" | "a" | "Hello world" | 1MB string | Unicode, null bytes |
| Tool Name | - | - | "get_weather" | 255 chars | Special chars |
| Role | - | - | "user" | - | Invalid roles |
| URL | - | - | "https://..." | 2048 chars | Invalid schemes |

## 6. State Transition Matrix

### Tool Invocation States

| Current State | Valid Next States | Invalid Transitions | Test Scenario |
|---------------|------------------|-------------------|---------------|
| IDLE | CALL | PARTIAL_CALL, RESULT | Normal flow start |
| CALL | PARTIAL_CALL, EXECUTING | IDLE, RESULT | Tool call initiated |
| PARTIAL_CALL | PARTIAL_CALL, COMPLETE | RESULT, ERROR | Streaming arguments |
| COMPLETE | EXECUTING | IDLE, PARTIAL_CALL | Arguments ready |
| EXECUTING | RESULT, ERROR | CALL, PARTIAL_CALL | Tool running |
| RESULT | IDLE | EXECUTING, CALL | Success completion |
| ERROR | IDLE | EXECUTING, RESULT | Error recovery |

### Invalid Transition Tests
- **Test IDLE→RESULT**: Send result without call
- **Test PARTIAL→RESULT**: Execute with incomplete args
- **Test RESULT→EXECUTING**: Double execution
- **Test ERROR→EXECUTING**: Retry without reset

## 7. Testing Recommendations for Hexagonal Migration

### Layer-Specific Testing Focus

#### Domain Layer
- Test all entity validations with boundary values
- Verify immutability constraints
- Test all custom exceptions
- Validate value object constraints

#### Application Layer
- Mock ALL external dependencies
- Test async generator streams
- Verify use case orchestration
- Test error propagation

#### Infrastructure Layer
- Mock OpenAI client responses
- Test all error status codes
- Verify retry logic
- Test connection pooling

#### Web Layer
- Test streaming response format
- Verify backward compatibility
- Test DI container overrides
- Validate DTO mappings

### Migration Testing Checklist

- [ ] All P0 test cases implemented
- [ ] All P1 test cases implemented
- [ ] Streaming format unchanged (0:, 9:, a:, e:)
- [ ] Frontend contract preserved
- [ ] Tool execution identical
- [ ] Error messages consistent
- [ ] Performance benchmarks met
- [ ] Concurrent request handling verified
- [ ] Memory leak tests passed
- [ ] Load testing completed

### Coverage Targets
- Domain: 95%+ coverage
- Application: 90%+ coverage
- Infrastructure: 85%+ coverage
- Web: 80%+ coverage
- Overall: 85%+ coverage

## 8. Test Data Fixtures

### Standard Test Messages
```python
FIXTURES = {
    "simple_message": {"role": "user", "content": "Hello"},
    "with_attachment": {
        "role": "user",
        "content": "Analyze",
        "experimental_attachments": [...]
    },
    "with_tool_call": {
        "role": "assistant",
        "toolInvocations": [...]
    },
    "empty_content": {"role": "user", "content": ""},
    "unicode_content": {"role": "user", "content": "Hello 👋 世界"},
    "very_long": {"role": "user", "content": "x" * 100000}
}
```

### Mock Responses
```python
MOCK_OPENAI_RESPONSES = {
    "success": {"choices": [...], "usage": {...}},
    "rate_limit": {"error": {"code": 429, "message": "Rate limit"}},
    "invalid_key": {"error": {"code": 401, "message": "Invalid key"}},
    "tool_call": {"choices": [{"delta": {"tool_calls": [...]}}]}
}
```

## 9. Performance Testing Requirements

### Load Testing Scenarios
1. **Sustained Load**: 100 req/min for 1 hour
2. **Spike Test**: 0→500 req/min in 30 seconds
3. **Soak Test**: 50 req/min for 24 hours
4. **Stress Test**: Increase until failure

### Performance Metrics
- P50 latency < 500ms (first token)
- P95 latency < 2000ms (first token)
- P99 latency < 5000ms (first token)
- Memory usage < 1GB per instance
- No memory leaks over 24 hours

## 10. Security Testing

### Input Validation
- SQL injection attempts in content
- XSS payloads in messages
- Path traversal in attachment URLs
- Command injection in tool arguments
- XXE in XML attachments
- SSRF via attachment URLs

### Rate Limiting
- Per-IP rate limits
- Per-API-key limits
- Concurrent connection limits
- Message size limits
- Total request size limits

## Conclusion

This comprehensive test plan ensures ZERO functionality regression during the hexagonal architecture migration. All edge cases have been cataloged, prioritized, and provided with test templates. Following this plan will guarantee a safe, reliable migration while maintaining backward compatibility and improving testability.

**Key Success Metrics:**
- Zero production incidents post-migration
- All P0/P1 test cases passing
- 85%+ overall test coverage
- No performance degradation
- Complete backward compatibility

**Next Steps:**
1. Implement P0 test cases first
2. Set up CI/CD with test gates
3. Perform load testing before production
4. Monitor error rates post-deployment
5. Iterate based on production learnings