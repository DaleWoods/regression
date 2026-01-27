package regression.pages;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import regression.utils.WaitUtils;

import java.time.Duration;

/**
 * PDP page object: add to bag and hand off to MiniBag for the drawer flow.
 */
public class PDP {
    private final WebDriver driver;
    private final WaitUtils wait;

    // Add-to-bag button
    private final By addToBagButton = By.xpath(
        "//form[contains(@class,'addToCartForm')]//button[@type='submit' and contains(@class,'addToCartButton')]"
    );

    // Transient "busy/disabled" indication on some templates
    private final By addToBagBusy = By.xpath(
        "//form[contains(@class,'addToCartForm')]//button[contains(@class,'addToCartButton')]" +
        "[ @disabled or contains(@class,'disabled') or @aria-busy='true' ]"
    );

    public PDP(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    /** Adds current PDP item to the bag and waits until the action settles. */
    public void addToBag() {
        wait.waitForPageLoad();
        WebElement btn = new WebDriverWait(driver, Duration.ofSeconds(15))
                .until(ExpectedConditions.elementToBeClickable(addToBagButton));

        scrollIntoView(btn);
        try {
            btn.click();
        } catch (ElementClickInterceptedException | JavascriptException e) {
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", btn);
        }

        // If a busy state appears briefly, wait for it to pass
        try {
            new WebDriverWait(driver, Duration.ofSeconds(2))
                    .until(ExpectedConditions.presenceOfElementLocated(addToBagBusy));
        } catch (TimeoutException ignored) { }

        // Let the drawer open or the button settle; we don't force open here
        try {
            new WebDriverWait(driver, Duration.ofSeconds(10))
                    .until(d -> {
                        try {
                            WebElement b = d.findElement(addToBagButton);
                            // Settled if enabled and not busy
                            return b.isEnabled() && !"true".equalsIgnoreCase(b.getAttribute("aria-busy"));
                        } catch (NoSuchElementException e) {
                            return true; // replaced in DOM -> treat as settled
                        }
                    });
        } catch (TimeoutException ignored) { }
    }

    private void scrollIntoView(WebElement el) {
        try { new Actions(driver).moveToElement(el).perform(); } catch (Exception ignored) { }
        try {
            ((JavascriptExecutor) driver).executeScript(
                    "arguments[0].scrollIntoView({block:'center', inline:'center'});", el);
        } catch (Exception ignored) { }
    }
}