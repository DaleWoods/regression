package regression.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import regression.utils.WaitUtils;

/**
 * Minimal Order Confirmation page object.
 * - Wait for the page to load
 * - Optional: get order reference text
 * - Wait 5 seconds before closing (per test plan)
 */
public class OrderConfirmation {

    private final WebDriver driver;
    private final WaitUtils wait;

    // Basic heading marker (soft): "Thank you" or "Order confirmation"
    private final By confirmationHeading = By.xpath(
        "//h1[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'thank you')" +
        " or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'order confirmation')]"
    );

    // A simple, tolerant match for order reference/number text
    private final By orderReferenceText = By.xpath(
        "//*[self::p or self::span or self::div or self::b]" +
        "[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'order reference')" +
        " or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'reference')" +
        " or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'order number')]"
    );

    public OrderConfirmation(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    /** Waits for the confirmation page to settle. */
    public void waitForConfirmationPage() {
        wait.waitForPageLoad();
        // Soft check – won't throw if heading isn't present
        try { wait.waitForVisible(confirmationHeading); } catch (Exception ignored) {}
    }

    /**
     * Returns the order reference text if found, otherwise null.
     * (Kept simple – we'll refine if needed)
     */
    public String getOrderReference() {
        wait.waitForPageLoad();
        try {
            String raw = wait.waitForVisible(orderReferenceText).getText();
            return tidyReference(raw);
        } catch (TimeoutException e) {
            return null;
        }
    }

    /** Per your plan: pause 5 seconds on the confirmation page. */
    public void waitFiveSecondsBeforeClose() {
        try { Thread.sleep(5000); } catch (InterruptedException ignored) {}
    }

    // --- tiny helper to trim labels from the captured text ---
    private String tidyReference(String text) {
        if (text == null) return null;
        String cleaned = text
                .replace("Order Reference", "")
                .replace("Order reference", "")
                .replace("Reference", "")
                .replace("reference", "")
                .replace("Order Number", "")
                .replace("Order number", "")
                .trim();
        return cleaned.isEmpty() ? text.trim() : cleaned;
    }
}