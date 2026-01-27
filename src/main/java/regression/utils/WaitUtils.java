package regression.utils;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/**
 * Minimal explicit wait helper used by page objects.
 * Covers: page load, visible, clickable, presence, invisibility, and small pauses.
 */
public class WaitUtils {
    private final WebDriver driver;
    private final WebDriverWait wait;

    /**
     * Default constructor with a 20 second timeout.
     */
    public WaitUtils(WebDriver driver) {
        this(driver, 20);
    }

    /**
     * Constructor with custom timeout (in seconds).
     */
    public WaitUtils(WebDriver driver, long timeoutSeconds) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
    }

    /**
     * Wait until the browser reports the document is fully loaded.
     * Uses JS: document.readyState === 'complete'.
     */
    public void waitForPageLoad() {
        new WebDriverWait(driver, Duration.ofSeconds(30))
            .until(webDriver -> {
                try {
                    String state = (String) ((JavascriptExecutor) webDriver)
                        .executeScript("return document.readyState");
                    return "complete".equals(state);
                } catch (JavascriptException e) {
                    // In rare cases JS may be unavailable briefly; retry via wait
                    return false;
                }
            });
    }

    /**
     * Wait until an element is visible on the page and return it.
     */
    public WebElement waitForVisible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    /**
     * Wait until an element is clickable and return it.
     */
    public WebElement waitForClickable(By locator) {
        return wait.until(ExpectedConditions.elementToBeClickable(locator));
    }

    /**
     * Wait until an element is present in the DOM (may not be visible yet).
     */
    public WebElement waitForPresence(By locator) {
        return wait.until(ExpectedConditions.presenceOfElementLocated(locator));
    }

    /**
     * Wait until an element becomes invisible (returns true if it becomes invisible).
     */
    public boolean waitForInvisibility(By locator) {
        return wait.until(ExpectedConditions.invisibilityOfElementLocated(locator));
    }

    /**
     * Small, explicit pause. Use sparingly.
     */
    public void smallPause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    // ------------------------------------------------------------
    // NEW: Iframe switch with readiness settle (non-breaking add)
    // ------------------------------------------------------------
    /**
     * Switches into an iframe when it's mounted and its document is ready.
     * Leaves you INSIDE the iframe (caller should switch back to defaultContent() when done).
     */
    public void switchToIframeWhenReady(By iframeLocator, long timeoutSeconds) {
        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        // 1) Wait for the frame & switch into it
        w.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(iframeLocator));
        // 2) Best-effort settle: ensure the iframe document is ready
        try {
            new WebDriverWait(driver, Duration.ofSeconds(3))
                .until(d -> {
                    try {
                        Object rs = ((JavascriptExecutor) d).executeScript("return document.readyState");
                        return "complete".equals(rs);
                    } catch (Exception e) {
                        return false;
                    }
                });
        } catch (TimeoutException ignored) {
            // it's okay; many gateways use minimalist iframes that never hit 'complete'
        }
    }
}