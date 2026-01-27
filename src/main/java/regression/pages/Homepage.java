// file: src/main/java/regression/pages/Homepage.java
package regression.pages;

import org.openqa.selenium.*; 
import org.openqa.selenium.interactions.Actions; 
import org.openqa.selenium.support.ui.ExpectedConditions; 
import org.openqa.selenium.support.ui.WebDriverWait; 
import regression.utils.WaitUtils; 
import java.time.Duration; 

public class Homepage {
    private final WebDriver driver; 
    private final WaitUtils wait; 

    // ===============================
    // Locators
    // ===============================

    // Primary "Watches" link in the desktop navbar.
    // Matches a structure like:
    //   <li id="desktopNavNode5">
    //     <a class="ng-star-inserted">Watches</a>
    //   </li>
    // Based on provided HTML sources (01_Home.html / 02_MenWatches.html).
    private final By watchesLinkPrimary = By.xpath(
        "//li[@id='desktopNavNode5']/a[@class='ng-star-inserted']"
    ); 

    // Fallback "Watches" link: text-based and case-insensitive (via normalize-space()).
    // This is more tolerant if IDs/classes change or markup is slightly different.
    private final By watchesLinkFallback = By.xpath(
        "//a[normalize-space() = 'Watches' or contains(normalize-space(),'Watch')]"
    ); 

    // ===============================
    // Constructor
    // ===============================

    /**
     * Creates the homepage POM.
     * @param driver active WebDriver instance
     */
    public Homepage(WebDriver driver) { 
        this.driver = driver; 
        this.wait = new WaitUtils(driver); 
    } 

    // ===============================
    // Actions
    // ===============================

    /**
     * Navigates from the homepage to the Watches category.
     *
     * What it does:
     *  1) Waits for the page to be fully loaded.
     *  2) Attempts to locate a clickable "Watches" nav link using the primary locator, then the fallback.
     *  3) Scrolls the element into view (Actions + JS) to avoid interception/overlays.
     *  4) Clicks the element (standard click with JS fallback).
     *  5) Waits for the target page to load.
     *
     * Why this approach:
     *  - Global marketing/analytics overlays or late-loading nav can briefly intercept clicks; we
     *    use elementToBeClickable + scroll + JS fallback to mitigate.
     */
    /** Attempts to click Watches using primary → fallback locators. */
    public void goToWatches() { 
        // Ensure DOM/network are settled before trying to interact with the global nav
        wait.waitForPageLoad(); 

        // Try the exact desktop nav locator first; if that fails, fall back to a text match.
        WebElement watches = findFirstClickable(
            10, 
            watchesLinkPrimary, 
            watchesLinkFallback
        ); 

        // Defensive: scroll into view so the click is less likely to be intercepted by sticky headers/banners
        scrollIntoView(watches); 

        try { 
            // Prefer a native WebDriver click when possible
            watches.click(); 
        } catch (ElementClickInterceptedException 
                 | JavascriptException e) { 
            // If something overlays the link or the element is covered during animation,
            // use a JS-click as a last resort.
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", watches); 
        } 

        // Wait for navigation to complete on the destination page
        wait.waitForPageLoad(); 
    } 

    // =========================================================
    // Helpers (internal)
    // =========================================================

    /**
     * Returns the first locator that produces an elementToBeClickable within the given timeout.
     * Useful when we maintain a DOM-specific locator and a looser fallback.
     *
     * @param timeoutSeconds overall timeout applied sequentially per locator try
     * @param locators one or more locators (tried in order)
     * @return the first clickable element found
     * @throws NoSuchElementException if none become clickable within the total attempts
     */
    private WebElement findFirstClickable(long timeoutSeconds, By... locators) { 
        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds)); 
        for (By by : locators) { 
            try { 
                // elementToBeClickable -> displayed && enabled, reducing timing issues with menus
                return w.until(ExpectedConditions.elementToBeClickable(by)); 
            } catch (Exception ignored) { 
                // Try next locator
            } 
        } 
        throw new NoSuchElementException("None of the HomePage Watches locators became clickable."); 
    } 

    /**
     * Brings an element into the viewport to reduce click interception.
     * Uses Actions first; if that is insufficient, falls back to JS scrollIntoView.
     *
     * Notes against provided HTML:
     * - Global elements like consent banners or sticky headers can overlap; centering the target helps.
     */
    private void scrollIntoView(WebElement el) { 
        try { 
            new Actions(driver).moveToElement(el).perform(); 
        } catch (Exception ignored) { /* If Actions fails, JS will handle */ } 

        try { 
            ((JavascriptExecutor) driver).executeScript(
                "arguments[0].scrollIntoView({block:'center', inline:'center'});", 
                el
            ); 
        } catch (Exception ignored) { } 
    } 
}