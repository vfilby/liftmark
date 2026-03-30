import XCTest
@testable import LiftMark

final class AnthropicServiceTests: XCTestCase {

    // Use the shared singleton — reset state between tests
    private var service: AnthropicService { AnthropicService.shared }

    override func tearDown() {
        service.clear()
        super.tearDown()
    }

    // MARK: - Initialization Lifecycle

    func testNotInitializedByDefault() {
        service.clear()
        XCTAssertFalse(service.isInitialized)
    }

    func testInitializeWithValidKey() {
        service.initialize(apiKey: "sk-ant-test-key")
        XCTAssertTrue(service.isInitialized)
    }

    func testInitializeWithEmptyKeyDoesNothing() {
        service.clear()
        service.initialize(apiKey: "")
        XCTAssertFalse(service.isInitialized)
    }

    func testClearResetsInitialization() {
        service.initialize(apiKey: "sk-ant-test-key")
        XCTAssertTrue(service.isInitialized)
        service.clear()
        XCTAssertFalse(service.isInitialized)
    }

    func testReinitializeOverwritesPreviousKey() {
        service.initialize(apiKey: "sk-ant-first")
        service.initialize(apiKey: "sk-ant-second")
        XCTAssertTrue(service.isInitialized)
    }

    // MARK: - Available Models Configuration

    func testAvailableModelsContainsHaiku() {
        let haiku = AnthropicService.availableModels["haiku-4.5"]
        XCTAssertNotNil(haiku)
        XCTAssertEqual(haiku?.id, "claude-haiku-4-5-20251001")
        XCTAssertEqual(haiku?.name, "Claude Haiku 4.5")
    }

    func testAvailableModelsContainsSonnet() {
        let sonnet = AnthropicService.availableModels["sonnet-4.5"]
        XCTAssertNotNil(sonnet)
        XCTAssertEqual(sonnet?.id, "claude-sonnet-4-5-20250929")
        XCTAssertEqual(sonnet?.name, "Claude Sonnet 4.5")
    }

    func testAvailableModelsCount() {
        XCTAssertEqual(AnthropicService.availableModels.count, 2)
    }

    func testModelDescriptionsAreNotEmpty() {
        for (_, model) in AnthropicService.availableModels {
            XCTAssertFalse(model.description.isEmpty, "Model \(model.name) has empty description")
        }
    }

    // MARK: - GenerateWorkout: Empty API Key

    func testGenerateWorkoutWithEmptyKeyReturnsError() async {
        let result = await service.generateWorkout(apiKey: "", prompt: "test")
        XCTAssertFalse(result.success)
        XCTAssertNil(result.workout)
        XCTAssertNotNil(result.error)
        XCTAssertEqual(result.error?.type, "missing_api_key")
    }

    func testGenerateWorkoutWithWhitespaceOnlyKeyReturnsError() async {
        let result = await service.generateWorkout(apiKey: "   \n\t  ", prompt: "test")
        XCTAssertFalse(result.success)
        XCTAssertNil(result.workout)
        XCTAssertEqual(result.error?.type, "missing_api_key")
    }

    func testGenerateWorkoutMissingKeyErrorMessage() async {
        let result = await service.generateWorkout(apiKey: "", prompt: "test")
        XCTAssertTrue(result.error?.message.contains("API key is required") == true)
    }

    // MARK: - Type Construction

    func testAnthropicErrorProperties() {
        let error = AnthropicError(message: "test error", type: "test_type", status: 401)
        XCTAssertEqual(error.message, "test error")
        XCTAssertEqual(error.type, "test_type")
        XCTAssertEqual(error.status, 401)
    }

    func testAnthropicErrorOptionalFields() {
        let error = AnthropicError(message: "minimal", type: nil, status: nil)
        XCTAssertEqual(error.message, "minimal")
        XCTAssertNil(error.type)
        XCTAssertNil(error.status)
    }

    func testGenerateWorkoutResultSuccess() {
        let result = GenerateWorkoutResult(success: true, workout: "# Workout", error: nil)
        XCTAssertTrue(result.success)
        XCTAssertEqual(result.workout, "# Workout")
        XCTAssertNil(result.error)
    }

    func testGenerateWorkoutResultFailure() {
        let error = AnthropicError(message: "fail", type: "test", status: 500)
        let result = GenerateWorkoutResult(success: false, workout: nil, error: error)
        XCTAssertFalse(result.success)
        XCTAssertNil(result.workout)
        XCTAssertEqual(result.error?.message, "fail")
    }

    func testAnthropicModelProperties() {
        let model = AnthropicModel(id: "test-id", name: "Test Model", description: "A test model")
        XCTAssertEqual(model.id, "test-id")
        XCTAssertEqual(model.name, "Test Model")
        XCTAssertEqual(model.description, "A test model")
    }

    // MARK: - AnthropicError conforms to Error

    func testAnthropicErrorIsError() {
        let error: Error = AnthropicError(message: "test", type: nil, status: nil)
        XCTAssertNotNil(error)
    }

    // MARK: - SecureStorage API Key Validation (supplemental edge cases)

    func testValidateKeyWithNewlinesAroundIt() {
        let key = "\nsk-ant-" + String(repeating: "a", count: 95) + "\n"
        XCTAssertTrue(SecureStorage.validateAnthropicApiKey(key))
    }

    func testValidateKeyWithTabsAroundIt() {
        let key = "\tsk-ant-" + String(repeating: "b", count: 100) + "\t"
        XCTAssertTrue(SecureStorage.validateAnthropicApiKey(key))
    }

    func testValidateKeyWithInternalSpaceFails() {
        let key = "sk-ant-" + String(repeating: "a", count: 47) + " " + String(repeating: "a", count: 47)
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey(key))
    }

    func testValidateKeyPrefixCaseSensitive() {
        let key = "SK-ANT-" + String(repeating: "a", count: 95)
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey(key))
    }

    func testValidateKeyWithOnlyPrefix() {
        XCTAssertFalse(SecureStorage.validateAnthropicApiKey("sk-ant-"))
    }
}
