package regression.pages;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import regression.utils.WaitUtils;

import java.time.Duration;

/**
 * Cart page (hardened).
 * - Tolerant CTA locator (button or link, case-insensitive)
 * - Wait for cart heading (soft)
 * - Scroll into view + click with JS fallback
 * - Small retry window for transient overlays
 */
public class Cart {
    private final WebDriver driver;
    private final WaitUtils wait;

    // Headings: "Shopping Bag" / "Cart"
    private final By cartHeading = By.xpath(
        "//h1[" +
        " contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'shopping bag')" +
        " or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'cart')" +
        "]"
    );

    // CTA may be <button> or <a>
    private final By checkoutSecurelyCta = By.xpath(
        "(" +
        " //button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'checkout securely')]" +
        " | //a[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'checkout securely')]" +
        ")"
    );

    private final By anyOverlay = By.cssSelector(
        "[class*='overlay'],[class*='spinner'],[class*='loading'],[aria-busy='true']"
    );

    public Cart(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    public void waitForCartPage() {
        wait.waitForPageLoad();
        try { new WebDriverWait(driver, Duration.ofSeconds(5)).until(ExpectedConditions.visibilityOfElementLocated(cartHeading)); }
        catch (Exception ignored) { }
    }

    public void checkoutSecurely() {
        waitForCartPage();

        // let overlays disappear if present
        try {
            new WebDriverWait(driver, Duration.ofSeconds(2))
                .until(ExpectedConditions.invisibilityOfElementLocated(anyOverlay));
        } catch (Exception ignored) { }

        WebElement cta = new WebDriverWait(driver, Duration.ofSeconds(15))
                .until(ExpectedConditions.elementToBeClickable(checkoutSecurelyCta));
        scrollIntoView(cta);

        try {
            cta.click();
        } catch (ElementClickInterceptedException | JavascriptException e) {
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", cta);
        }

        // Retry once if navigation did not initiate
        if (!urlContains("/checkout") && !documentReadyChangedWithin(2)) {
            try {
                cta = new WebDriverWait(driver, Duration.ofSeconds(5))
                        .until(ExpectedConditions.elementToBeClickable(checkoutSecurelyCta));
                scrollIntoView(cta);
                ((JavascriptExecutor) driver).executeScript("arguments[0].click();", cta);
            } catch (Exception ignored) { }
        }

        wait.waitForPageLoad();
    }

    private void scrollIntoView(WebElement el) {
        try { new Actions(driver).moveToElement(el).perform(); } catch (Exception ignored) { }
        try {
            ((JavascriptExecutor) driver).executeScript(
                "arguments[0].scrollIntoView({block:'center', inline:'center'});", el);
        } catch (Exception ignored) { }
    }

    private boolean urlContains(String token) {
        try { return driver.getCurrentUrl() != null && driver.getCurrentUrl().contains(token); }
        catch (Exception e) { return false; }
    }

    private boolean documentReadyChangedWithin(int seconds) {
        long deadline = System.currentTimeMillis() + seconds * 1000L;
        String initial = null;
        try { initial = (String)((JavascriptExecutor)driver).executeScript("return document.readyState"); }
        catch (Exception ignored) { }
        while (System.currentTimeMillis() < deadline) {
            try {
                String now = (String)((JavascriptExecutor)driver).executeScript("return document.readyState");
                if (now != null && !now.equals(initial)) return true;
                Thread.sleep(150);
            } catch (Exception ignored) { Thread.currentThread().interrupt(); }
        }
        return false;
    }
}