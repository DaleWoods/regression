// file: src/main/java/regression/pages/MenWatches.java
package regression.pages; 

import org.openqa.selenium.*; 
import org.openqa.selenium.support.ui.ExpectedConditions; 
import org.openqa.selenium.support.ui.WebDriverWait; 
import regression.utils.WaitUtils; 
import java.net.URI; 
import java.time.Duration; 

/**
 * MenWatches
 *
 * Purpose:
 *  - Navigate from wherever we are (typically Home or Watches landing) to the Men's Watches PLP.
 *
 * Strategy (progressive fallbacks):
 *  1) If we're already on the Men’s PLP → return immediately.
 *  2) If we're on the Watches landing page (/c/Watches) → click the Men's Watches tile.
 *  3) Otherwise try the mega‑menu deep link to Men's Watches (first match).
 *  4) If available, click "Shop All Watches" to reach the landing, then click the Men's tile.
 *  5) Final fallback: direct navigation to the Men’s PLP path (absolute URL built from current host).
 */
public class MenWatches { 
    private final WebDriver driver; 
    private final WaitUtils wait; 

    // --- Where we want to end up ---
    // Normalised paths used for URL checks and building absolute fallback.
    private static final String MENS_PLP_PATH = "/c/Watches/Mens-Watches"; 
    private static final String WATCHES_LANDING_PATH = "/c/Watches"; 

    // --- Tile on /c/Watches (landing page) ---
    // Matches: <a href="/c/Watches/Mens-Watches">...</a> on the landing page grid/card.
    private final By mensWatchesTile = By.xpath("//a[contains(@href, '/c/Watches/Mens-Watches')]"); 

    // --- Mega‑menu link (when menu is open or the link is present in DOM) ---
    // We pick the first deep link occurrence to Men's Watches.
    private final By megaMenuMensLink = By.xpath(
        "(//a[contains(@href, '/c/Watches/Mens-Watches')])[1]"
    ); 

    // Optional: “Shop All Watches” on the mega‑menu/landing image to reach /c/Watches.
    // This is a helper path to then click the Men’s tile on the landing page.
    private final By shopAllWatchesLink = By.xpath(
        "//a[contains(@href, '/c/Watches') and " + 
        "(contains(normalize-space(.),'Shop All Watches') or contains(@aria-label,'Shop All Watches'))]"
    ); 

    /**
     * Create the MenWatches navigation helper.
     * @param driver active WebDriver instance
     */
    public MenWatches(WebDriver driver) { 
        this.driver = driver; 
        this.wait = new WaitUtils(driver); 
    } 

    /**
     * Navigates to the Men's Watches PLP using a series of robust fallbacks.
     *
     * Flow:
     *  - Wait for current page load.
     *  - Early exit if already on the target PLP.
     *  - If on /c/Watches → click the Men's tile.
     *  - Else try the mega‑menu link to Men's Watches.
     *  - Else, try "Shop All Watches" → then click the Men's tile on the landing.
     *  - Else, direct navigate to the PLP using the current origin + known path.
     *
     * Notes on waits:
     *  - elementToBeClickable guards against timing/overlay issues.
     *  - After each click, we wait for the target URL and then a full page load.
     */
    public void goToMensWatchesPLP() { 
        // Ensure current DOM/network are settled to avoid interacting mid-load
        wait.waitForPageLoad(); 

        // 1) Already there? Quick exit to avoid extra navigation.
        if (isOnMensPLP()) return; 

        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(25)); 

        // 2) If we are on /c/Watches landing → click the Men’s Watches tile.
        // Ties to HTML dump: landing cards link to /c/Watches/Mens-Watches.
        if (currentUrlContains(WATCHES_LANDING_PATH)) { 
            try { 
                WebElement tile = w.until(ExpectedConditions.elementToBeClickable(mensWatchesTile)); 
                scrollIntoView(tile); 
                safeClick(tile); 
                waitForMensPLPUrl(); 
                return; 
            } catch (TimeoutException ignored) { 
                // If the tile isn't interactable here, fall through to next fallback.
            } 
        } 

        // 3) Try the mega‑menu direct link (present on many templates even if not visible in the top nav).
        try { 
            WebElement link = w.until(ExpectedConditions.elementToBeClickable(megaMenuMensLink)); 
            scrollIntoView(link); 
            safeClick(link); 
            waitForMensPLPUrl(); 
            return; 
        } catch (TimeoutException ignored) { 
            // Continue to next option.
        } 

        // 4) Reach /c/Watches via "Shop All Watches", then click the Men's tile.
        try { 
            WebElement shopAll = w.until(ExpectedConditions.elementToBeClickable(shopAllWatchesLink)); 
            scrollIntoView(shopAll); 
            safeClick(shopAll); 
            wait.waitForPageLoad(); // landing page load

            // Now click the Men's tile on the landing.
            WebElement tile = w.until(ExpectedConditions.elementToBeClickable(mensWatchesTile)); 
            scrollIntoView(tile); 
            safeClick(tile); 
            waitForMensPLPUrl(); 
            return; 
        } catch (TimeoutException ignored) { 
            // Proceed to final fallback.
        } 

        // 5) Final fallback: direct navigation to the Men’s PLP using the current site origin.
        // Rationale: keeps test flow moving even if nav/tiles are not interactable in this run.
        driver.get(buildAbsoluteUrl(MENS_PLP_PATH)); 
        waitForMensPLPUrl(); 
    } 

    // ===============================
    // Internal helpers
    // ===============================

    /**
     * @return true if current URL contains the token (null-safe).
     */
    private boolean currentUrlContains(String token) { 
        try { 
            String url = driver.getCurrentUrl(); 
            return url != null && url.contains(token); 
        } catch (Exception e) { 
            return false; 
        } 
    } 

    /**
     * @return true if we appear to already be on the Men’s PLP (URL contains the known path).
     */
    private boolean isOnMensPLP() { 
        return currentUrlContains(MENS_PLP_PATH); 
    } 

    /**
     * Waits until the URL indicates we reached the Men’s PLP, then waits for page load.
     * Keeps the wait modest to allow for typical navigation + CMS latency.
     */
    private void waitForMensPLPUrl() { 
        new WebDriverWait(driver, Duration.ofSeconds(25)) 
            .until(drv -> currentUrlContains(MENS_PLP_PATH)); 
        wait.waitForPageLoad(); 
    } 

    /**
     * Bring a target into the viewport to avoid sticky headers/overlays capturing the click.
     * Using JS directly here is sufficient as we only need a simple center alignment.
     */
    private void scrollIntoView(WebElement el) { 
        try { 
            ((JavascriptExecutor) driver)
                .executeScript("arguments[0].scrollIntoView({block:'center', inline:'center'});", el); 
        } catch (Exception ignored) {} 
    } 

    /**
     * Clicks the element using native click with JS fallback if needed.
     * Protects against transient interceptions or animations.
     */
    private void safeClick(WebElement el) { 
        try { 
            el.click(); 
        } catch (Exception e) { 
            try { 
                ((JavascriptExecutor) driver).executeScript("arguments[0].click();", el); 
            } catch (Exception ignored) {} 
        } 
    } 

    /**
     * Builds an absolute URL for the provided path using the current page's scheme/authority.
     * If anything goes wrong, falls back to returning the path (relative navigation).
     *
     * Example:
     *   current: https://goldsmiths-uat.thewosgroup.com/...
     *   path   : /c/Watches/Mens-Watches
     *   result : https://goldsmiths-uat.thewosgroup.com/c/Watches/Mens-Watches
     */
    private String buildAbsoluteUrl(String path) { 
        try { 
            URI current = new URI(driver.getCurrentUrl()); 
            return new URI(current.getScheme(), current.getAuthority(), path, null, null).toString(); 
        } catch (Exception e) { 
            // Fallback – relative path still works from most contexts.
            return path; 
        } 
    } 
}