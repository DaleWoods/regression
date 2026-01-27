package regression.pages;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import regression.utils.WaitUtils;

import java.time.Duration;
import java.text.DateFormatSymbols;
import java.util.Locale;

public class CheckoutPage3 {
    private final WebDriver driver;
    private final WaitUtils wait;

    // ========================================
    // PAYMENT OPTION BLOCK
    // ========================================
    private final By creditCardBlock = By.cssSelector(
        "div.spCheckoutPaymentOptionBlock[aria-label*='Credit']," +
        "div.spCheckoutPaymentOptionBlock[data-action='cardPaymentComponent']"
    );

    // ========================================
    // IFRAMES (confirmed in your DOM)
    // ========================================
    private final By cardNumberIframe = By.cssSelector("iframe[title='Iframe for card number']");
    private final By expiryIframe     = By.cssSelector("iframe[title='Iframe for expiry date']");
    private final By cvcIframe        = By.cssSelector("iframe[title='Iframe for security code']");

    // ========================================
    // Tolerant inputs INSIDE the iframes
    // ========================================
    private final By[] numberFieldCandidates = new By[] {
        By.cssSelector("input[name='encryptedCardNumber']"),
        By.cssSelector("input[data-fieldtype='encryptedCardNumber']"),
        By.cssSelector("input[id*='encryptedCardNumber']"),
        By.cssSelector("input[autocomplete='cc-number']"),
        By.cssSelector("input")
    };
    private final By[] expiryFieldCandidates = new By[] {
        By.cssSelector("input[name='encryptedExpiryDate']"),
        By.cssSelector("input[data-fieldtype='encryptedExpiryDate']"),
        By.cssSelector("input[data-cse='encryptedExpiryDate']"),
        By.cssSelector("input[id*='encryptedExpiryDate']"),
        By.cssSelector("input[autocomplete='cc-exp']"),
        By.cssSelector("input")
    };
    private final By[] cvcFieldCandidates = new By[] {
        By.cssSelector("input[name='encryptedSecurityCode']"),
        By.cssSelector("input[data-fieldtype='encryptedSecurityCode']"),
        By.cssSelector("input[id*='encryptedSecurityCode']"),
        By.cssSelector("input[autocomplete='cc-csc']"),
        By.cssSelector("input")
    };

    // ========================================
    // PAY BUTTON – tolerant candidate list
    // ========================================
    private final By[] payButtonCandidates = new By[] {
        // common data-action / class
        By.cssSelector("button[data-action='placeOrder']"),
        By.cssSelector("button.spCheckoutPlaceOrderButton"),
        // explicit text (button)
        By.xpath("//button[normalize-space(.)='Pay By Debit/Credit Card']"),
        By.xpath("//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'pay by debit')]"),
        // span text -> climb to button
        By.xpath("//span[normalize-space(.)='Pay By Debit/Credit Card']/ancestor::button[1]"),
        By.xpath("//span[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'pay by debit')]/ancestor::button[1]"),
        // role='button' on a or div containers
        By.xpath("//*[self::a or self::div][@role='button'][contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'pay by debit')]"),
        // very broad fallbacks by class containing 'button' + text
        By.xpath("//*[contains(@class,'button')][contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'pay by debit')]")
    };

    public CheckoutPage3(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    // ==========================================================
    // Step 1: Select Credit/Debit Card
    // ==========================================================
    public void selectCreditDebitCard() {
        wait.waitForPageLoad();
        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(30));
        WebElement block = w.until(ExpectedConditions.elementToBeClickable(creditCardBlock));
        scrollIntoView(block);
        safeClick(block);

        // Wait until number iframe mounted (now via WaitUtils helper)
        try {
            driver.switchTo().defaultContent();
        } catch (Exception ignored) {}
        wait.switchToIframeWhenReady(cardNumberIframe, 20);
        driver.switchTo().defaultContent();
    }

    // ==========================================================
    // Step 2: Enter Card Details
    // ==========================================================
    public void enterCardDetails(String number, String expiry, String cvv) {
        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(30));

        String cleanNumber = normalizeCardNumber(number);
        String cleanExpiry = normalizeExpiry(expiry);
        String cleanCvc    = normalizeCvc(cvv);

        // number first (enables/refreshes others)
        typeInIframe(cardNumberIframe, numberFieldCandidates, cleanNumber, w);

        // Allow brand detection & any remounts (kept modest)
        sleep(200);

        // expiry + cvv (will be quick due to new short-per-candidate waits)
        typeInIframe(expiryIframe, expiryFieldCandidates, cleanExpiry, w);
        typeInIframe(cvcIframe,    cvcFieldCandidates,    cleanCvc,   w);
    }

    // ==========================================================
    // Step 3: Click Pay Button
    // ==========================================================
    public void payByCard() {
        // Always be in default content for Pay CTA
        try { driver.switchTo().defaultContent(); } catch (Exception ignored) {}
        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(30));

        WebElement btn = findFirstDisplayed(payButtonCandidates, w);
        if (btn == null) {
            throw new NoSuchElementException("Could not locate the Pay button using known locators.");
        }

        scrollIntoView(btn);

        // If disabled due to invalid PAN, this will wait until enabled (or timeout by design)
        w.until(d -> btn.isDisplayed() && btn.isEnabled());

        try {
            w.until(ExpectedConditions.elementToBeClickable(btn));
            btn.click();
        } catch (Exception e) {
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", btn);
        }
    }

    // ==========================================================
    // Internal helpers
    // ==========================================================
    private void typeInIframe(By iframeLocator, By[] inputCandidates, String value, WebDriverWait w) {
        Exception last = null;

        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                // Use the refined iframe readiness helper
                driver.switchTo().defaultContent();
                wait.switchToIframeWhenReady(iframeLocator, 20);

                // NEW: quick-select among candidates (no long per-candidate waits)
                WebElement field = findFirstDisplayed(inputCandidates, w);
                if (field == null) throw new NoSuchElementException("No secured-field input visible inside iframe.");

                scrollIntoView(field);

                // Ensure interactable
                try {
                    new WebDriverWait(driver, Duration.ofSeconds(5))
                        .until(d -> field.isDisplayed() && field.isEnabled());
                } catch (TimeoutException ignored) {}

                try { field.click(); } catch (Exception ignored) {}
                try { field.clear(); } catch (Exception ignored) {}
                field.sendKeys(value);

                driver.switchTo().defaultContent();
                return;

            } catch (Exception e) {
                last = e;
                try { driver.switchTo().defaultContent(); } catch (Exception ignored) {}
                sleep(250);
            }
        }
        if (last != null) throw new RuntimeException(last);
    }

    /**
     * IMPORTANT CHANGE:
     * Previously this used the *same* 30s wait passed into the method for EACH candidate.
     * If the first candidate didn't exist, you'd pay ~30s before trying the next — causing the lag you saw.
     * Now we try each candidate with a SHORT timeout (1s), which removes the big per-candidate stalls.
     */
    private WebElement findFirstDisplayed(By[] candidates, WebDriverWait overallWait) {
        // We respect the overall wait budget but use a short per-candidate window.
        long end = System.nanoTime() + Duration.ofSeconds(15).toNanos(); // overall budget for finding a field
        Duration perCandidate = Duration.ofSeconds(1);

        while (System.nanoTime() < end) {
            for (By by : candidates) {
                try {
                    WebDriverWait shortWait = new WebDriverWait(driver, perCandidate);
                    WebElement el = shortWait.until(ExpectedConditions.presenceOfElementLocated(by));
                    if (el.isDisplayed()) return el;
                } catch (TimeoutException ignored) {
                    // try next candidate quickly
                }
            }
            // small backoff before next scan round
            sleep(100);
        }
        return null;
    }

    private void scrollIntoView(WebElement el) {
        try {
            ((JavascriptExecutor) driver)
                .executeScript("arguments[0].scrollIntoView({block:'center'});", el);
        } catch (Exception ignored) {}
    }

    private void safeClick(WebElement el) {
        try { el.click(); }
        catch (Exception e) {
            try { ((JavascriptExecutor) driver).executeScript("arguments[0].click();", el); }
            catch (Exception ignored) {}
        }
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) {}
    }

    // ==========================================================
    // CSV Normalisation
    // ==========================================================
    private String normalizeCardNumber(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("[^0-9]", "");
    }

    private String normalizeCvc(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("[^0-9]", "");
    }

    private String normalizeExpiry(String raw) {
        if (raw == null) return "";
        String s = raw.trim();

        // "Mar-30", "March 2030", "Mar 2030", etc.
        if (s.matches("^[A-Za-z]{3,9}[^0-9]*[0-9]{2,4}$")) {
            String monthName = s.replaceAll("[^A-Za-z]", "");
            int mm = monthNameToNumber(monthName);
            String digits = s.replaceAll("[^0-9]", "");
            String yy = digits.substring(digits.length() - 2);
            return String.format("%02d/%s", mm, yy);
        }

        // "0329" -> "03/29"
        if (s.matches("^[0-9]{4}$")) return s.substring(0, 2) + "/" + s.substring(2);

        // "03-29" or "03/29" -> normalise to "03/29"
        if (s.matches("^[0-9]{2}[/\\-][0-9]{2}$")) return s.replace("-", "/");

        // "03-2029" or "03/2029" -> "03/29"
        if (s.matches("^[0-9]{2}[/\\-][0-9]{4}$")) return s.substring(0, 2) + "/" + s.substring(s.length() - 2);

        return s;
    }

    private int monthNameToNumber(String name) {
        String[] shortMonths = new DateFormatSymbols(Locale.ENGLISH).getShortMonths();
        String n = name.toLowerCase(Locale.ROOT);
        for (int i = 0; i < shortMonths.length; i++) {
            if (shortMonths[i].toLowerCase(Locale.ROOT).startsWith(n.substring(0, 3))) return i + 1;
        }
        return 1;
    }
}