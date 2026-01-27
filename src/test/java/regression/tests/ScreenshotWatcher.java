package regression.tests;

import org.junit.jupiter.api.extension.*;
import org.openqa.selenium.*;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Captures screenshots for ANY failure:
 * - test method failure
 * - @BeforeEach failures
 * - @AfterEach failures
 * - unexpected exceptions
 */
public class ScreenshotWatcher implements TestWatcher, TestExecutionExceptionHandler {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    // Runs when a test method fails
    @Override
    public void testFailed(ExtensionContext context, Throwable cause) {
        capture(context, cause);
    }

    // Runs for ANY exception in Before/After/Test body
    @Override
    public void handleTestExecutionException(ExtensionContext context, Throwable throwable) throws Throwable {
        capture(context, throwable);
        throw throwable; // rethrow so test still fails
    }

    private void capture(ExtensionContext context, Throwable cause) {
        WebDriver driver = extractDriverFrom(context);
        if (driver == null) {
            System.err.println("[ScreenshotWatcher] No WebDriver — cannot capture screenshot.");
            return;
        }

        if (!(driver instanceof TakesScreenshot)) {
            System.err.println("[ScreenshotWatcher] Driver does not support screenshots.");
            return;
        }

        try {
            byte[] png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);

            String className = context.getRequiredTestClass().getSimpleName();
            String methodName = context.getTestMethod().map(m -> m.getName()).orElse("before_or_after_phase");
            String timestamp = LocalDateTime.now().format(TS);

            Path outDir = Paths.get(System.getProperty("user.dir"), "build", "screenshots", className);
            Files.createDirectories(outDir);

            Path outFile = outDir.resolve(methodName + "_" + timestamp + ".png");
            Files.write(outFile, png);

            System.out.println("[ScreenshotWatcher] SAVED: " + outFile.toAbsolutePath());
        } catch (IOException | WebDriverException e) {
            System.err.println("[ScreenshotWatcher] FAILED to capture screenshot: " + e.getMessage());
        }
    }

    private WebDriver extractDriverFrom(ExtensionContext context) {
        Object instance;
        try {
            instance = context.getRequiredTestInstance();
        } catch (Exception e) {
            return null;
        }
        return findDriver(instance);
    }

    private WebDriver findDriver(Object instance) {
        Class<?> c = instance.getClass();
        while (c != null) {
            try {
                Field f = c.getDeclaredField("driver");
                f.setAccessible(true);
                Object val = f.get(instance);
                if (val instanceof WebDriver) return (WebDriver) val;
            } catch (Exception ignored) {}
            c = c.getSuperclass();
        }
        return null;
    }
}