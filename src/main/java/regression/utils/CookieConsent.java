package regression.utils;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/**
 * Minimal cookie consent helper:
 * - Best-effort click on "Accept All Cookies" (OneTrust) if it appears.
 * - Returns quickly if not present. No extra logic.
 */
public final class CookieConsent {

    private CookieConsent() {}

    public static void acceptIfPresent(WebDriver driver) {
        if (driver == null) return;

        WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(3));

        // Try standard OneTrust id + simple text fallbacks
        By[] candidates = new By[] {
            By.id("onetrust-accept-btn-handler"),
            By.xpath("//button[normalize-space(.)='Accept All Cookies' or contains(.,'Accept All Cookies')]"),
            By.xpath("//button[contains(.,'Accept All')]")
        };

        for (By by : candidates) {
            try {
                WebElement btn = shortWait.until(ExpectedConditions.elementToBeClickable(by));
                btn.click();
                // Optional: brief wait for it to disappear
                try {
                    shortWait.until(ExpectedConditions.invisibilityOfElementLocated(by));
                } catch (Exception ignored) {}
                return; // done
            } catch (Exception ignored) {
                // Try next candidate
            }
        }
    }
}