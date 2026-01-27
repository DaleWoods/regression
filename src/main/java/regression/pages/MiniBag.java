package regression.pages;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import regression.utils.WaitUtils;

import java.time.Duration;

/**
 * Component object for the slide-out "mini bag" drawer on PDP.
 * Responsibilities:
 *  - Detect whether the panel is open.
 *  - Open it (only if needed).
 *  - Wait until the panel is visible/settled.
 *  - Click "VIEW SHOPPING BAG" and wait for navigation.
 */
public class MiniBag {

    private final WebDriver driver;
    private final WaitUtils wait;

    // --- Heuristics / tolerant locators ---

    // Heading typically reads "YOUR SHOPPING BAG"; we match case-insensitively
    private final By heading = By.xpath(
        "//*[self::h1 or self::h2 or self::h3]" +
        "[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'your shopping bag')]"
    );

    // The drawer's primary CTA at the bottom
    private final By viewShoppingBagButton = By.xpath(
        "(//a|//button)[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'view shopping bag')]"
    );

    // Optional icon to open the panel (only used if panel isn't open already)
    private final By bagIcon = By.cssSelector(
        "a[href*='/shopping-bag'], [data-test*='bag'], [data-qa*='bag'], [aria-label*='Bag']"
    );

    public MiniBag(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    /** True if we see evidence that the mini-bag drawer is already open. */
    public boolean isOpen() {
        try {
            if (isVisible(heading)) return true;
        } catch (Exception ignored) { }
        try {
            if (isVisible(viewShoppingBagButton)) return true;
        } catch (Exception ignored) { }
        return false;
    }

    /** Opens the mini-bag drawer if not already open, then waits until it's visible. */
    public void open() {
        if (isOpen()) {
            // Already open: nothing to do
            return;
        }

        // Click the bag icon to open the drawer
        WebElement icon = new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.elementToBeClickable(bagIcon));
        scrollIntoView(icon);
        try {
            icon.click();
        } catch (ElementClickInterceptedException | JavascriptException e) {
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", icon);
        }

        // Wait for the drawer to be open (heading or "View shopping bag" is visible)
        waitUntilOpen(Duration.ofSeconds(15));
    }

    /** Waits until the drawer is visible and settled. */
    public void waitUntilOpen(Duration timeout) {
        WebDriverWait w = new WebDriverWait(driver, timeout);
        w.until(d -> isOpen());
        // Extra small settle to ensure animation completed
        try { Thread.sleep(250); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
    }

    /** Clicks "VIEW SHOPPING BAG" when it becomes clickable and waits for the page to load. */
    public void clickViewShoppingBag() {
        WebElement viewBtn = new WebDriverWait(driver, Duration.ofSeconds(15))
                .until(ExpectedConditions.elementToBeClickable(viewShoppingBagButton));
        scrollIntoView(viewBtn);
        try {
            viewBtn.click();
        } catch (ElementClickInterceptedException | JavascriptException e) {
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", viewBtn);
        }
        // Cart page load
        wait.waitForPageLoad();
    }

    // ---------------- helpers ----------------

    private boolean isVisible(By by) {
        WebElement el = driver.findElement(by);
        return el != null && el.isDisplayed();
    }

    private void scrollIntoView(WebElement el) {
        try { new Actions(driver).moveToElement(el).perform(); } catch (Exception ignored) { }
        try {
            ((JavascriptExecutor) driver).executeScript(
                "arguments[0].scrollIntoView({block:'center', inline:'center'});", el);
        } catch (Exception ignored) { }
    }
}