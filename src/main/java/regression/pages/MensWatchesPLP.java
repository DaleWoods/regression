package regression.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptException;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.ElementClickInterceptedException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;


import regression.utils.WaitUtils;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Men's Watches PLP selector (stale-proof, JS-hardened):
 * - Existing, STABLE flow for functional journeys:
 *   selectFourthProduct() → resolves the PDP href for the 4th visible tile via JS and navigates with driver.get(href).
 *
 * - NEW analytics-only helper (adds, does NOT modify existing behaviour):
 *   clickRandomTile_GoToPdp_ForAnalytics(int minVisible) → randomly clicks a visible PLP tile (normal click),
 *   navigates to PDP, waits for /p/ in the URL and document ready, returns the href that was clicked.
 */
public class MensWatchesPLP {

    private final WebDriver driver;
    private final WaitUtils wait;

    // Tolerant product tile selectors (extend if theme varies)
    private static final String TILE_SELECTOR =
            "div.productTile, li.productTile, .productTileGrid .productTile";

    public MensWatchesPLP(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    // --------------------------------------------------------------------------------------------
    //  A) EXISTING METHOD (UNCHANGED) — PlaceOrderTest depends on this
    // --------------------------------------------------------------------------------------------

    /**
     * Clicks the 4th visible product (by navigating to its PDP href) and waits for PDP to load.
     * Implementation unchanged to avoid impacting existing tests.
     */
    public void selectFourthProduct() {
        wait.waitForPageLoad();

        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(30));

        // 1) Wait until the PLP has >= 4 visible tiles and the count is stable for a brief quiet period
        w.until(d -> {
            try {
                Long first = (Long) ((JavascriptExecutor) d)
                        .executeScript(JS_VISIBLE_TILE_COUNT, TILE_SELECTOR);
                if (first == null || first < 4) return false;
                sleep(200);
                Long second = (Long) ((JavascriptExecutor) d)
                        .executeScript(JS_VISIBLE_TILE_COUNT, TILE_SELECTOR);
                return second != null && second.equals(first) && second >= 4;
            } catch (Exception e) {
                return false;
            }
        });

        // 2) Try up to 3 times to obtain the PDP href for the 4th visible tile, then navigate
        Exception last = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                String href = (String) ((JavascriptExecutor) driver)
                        .executeScript(JS_GET_4TH_TILE_HREF, TILE_SELECTOR);
                if (href != null && href.contains("/p/")) {

                    driver.get(href);

                    boolean onPdp = new WebDriverWait(driver, Duration.ofSeconds(20))
                            .until(drv -> {
                                try {
                                    String url = drv.getCurrentUrl();
                                    return url != null && url.contains("/p/");
                                } catch (Exception e) {
                                    return false;
                                }
                            });

                    if (onPdp) {
                        wait.waitForPageLoad();
                        return;
                    }

                } else {
                    last = new IllegalStateException(
                            "Could not resolve 4th tile PDP href (got: " + href + ")");
                }

            } catch (JavascriptException | TimeoutException e) {
                last = e;
            }
            sleep(200);
        }

        if (last != null) throw new RuntimeException(last);
        throw new IllegalStateException("Failed to open PDP for the 4th product after retries.");
    }

    // --------------------------------------------------------------------------------------------
    //  B) EXISTING ANALYTICS METHOD — normal click, navigates to PDP
    // --------------------------------------------------------------------------------------------

    /**
     * Analytics-only helper:
     *  - Waits for the PLP grid to stabilize with >= minVisible tiles.
     *  - Picks one visible product tile at random (anchor with href containing '/p/').
     *  - Performs a normal click → navigates to PDP.
     *  - Waits until URL contains '/p/' and the page is fully loaded.
     */
    public String clickRandomTile_GoToPdp_ForAnalytics(int minVisible) {
        wait.waitForPageLoad();

        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(30));

        // Wait until visible tile count is stable & >= minVisible
        w.until(d -> {
            try {
                Long first = (Long) ((JavascriptExecutor) d)
                        .executeScript(JS_VISIBLE_TILE_COUNT, TILE_SELECTOR);
                if (first == null || first < minVisible) return false;
                sleep(200);
                Long second = (Long) ((JavascriptExecutor) d)
                        .executeScript(JS_VISIBLE_TILE_COUNT, TILE_SELECTOR);
                return Objects.equals(first, second) && second >= minVisible;
            } catch (Exception e) {
                return false;
            }
        });

        List<WebElement> tiles = driver.findElements(By.cssSelector(TILE_SELECTOR));

        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(drv -> tiles != null && !tiles.isEmpty());

        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(drv -> {
                    int visible = 0;
                    for (WebElement t : tiles) {
                        if (isEffectivelyVisible(t)) visible++;
                    }
                    return visible >= minVisible;
                });

        // Collect anchors to PDP
        java.util.ArrayList<WebElement> anchors = new java.util.ArrayList<>();
        for (WebElement t : tiles) {
            if (!isEffectivelyVisible(t)) continue;
            try {
                WebElement a = t.findElement(By.cssSelector("a[href*='/p/']"));
                if (isEffectivelyVisible(a)) anchors.add(a);
            } catch (NoSuchElementException ignored) {}
        }

        if (anchors.size() < minVisible) {
            throw new IllegalStateException(
                    "Only " + anchors.size() + " PDP anchors visible; need >= " + minVisible);
        }

        WebElement target = anchors.get(
                ThreadLocalRandom.current().nextInt(anchors.size()));

        String href = null;
        try { href = target.getAttribute("href"); } catch (Exception ignored) {}

        scrollIntoView(target);

        try {
            w.until(ExpectedConditions.elementToBeClickable(target));
            target.click();
        } catch (ElementClickInterceptedException | JavascriptException e) {
            ((JavascriptExecutor) driver).executeScript(
                    "arguments[0].click();", target);
        }

        w.until(drv -> {
            try {
                String url = drv.getCurrentUrl();
                return url != null && url.contains("/p/");
            } catch (Exception ex) {
                return false;
            }
        });

        wait.waitForPageLoad();
        return href;
    }

    // --------------------------------------------------------------------------------------------
    //  C) NEW — Option A: Install Analytics Listener ONLY (safe, isolated)
    // --------------------------------------------------------------------------------------------

    /**
     * Installs an analytics listener on the PLP BEFORE clicking a product.
     * This patches dataLayer.push so all pushes (including early PDP pushes)
     * are captured reliably.
     *
     * ZERO EFFECT on existing functional tests.
     */
    public void installDataLayerListenerOnPlp() {
        ((JavascriptExecutor) driver).executeScript(
                "window.dataLayer = window.dataLayer || [];" +
                "if (!window.__dlEvents) window.__dlEvents = [];" +
                "if (!window.__dlListenerInstalled) {" +
                "  window.__dlListenerInstalled = true;" +
                "  const orig = window.dataLayer.push;" +
                "  window.dataLayer.push = function() {" +
                "    try { window.__dlEvents.push(arguments[0]); } catch(e) {}" +
                "    return orig.apply(this, arguments);" +
                "  };" +
                "}"
        );
    }

    // --------------------------------------------------------------------------------------------
    // Helpers (unchanged)
    // --------------------------------------------------------------------------------------------

    private boolean isEffectivelyVisible(WebElement el) {
        try {
            if (el == null || !el.isDisplayed()) return false;
        } catch (StaleElementReferenceException e) {
            return false;
        }
        try {
            Object hasOffsetParent =
                    ((JavascriptExecutor) driver).executeScript(
                            "return arguments[0] && arguments[0].offsetParent !== null;", el);
            return Boolean.TRUE.equals(hasOffsetParent);
        } catch (JavascriptException e) {
            try { return el.isDisplayed(); } catch (Exception ex) { return false; }
        }
    }

    private void scrollIntoView(WebElement el) {
        try { new Actions(driver).moveToElement(el).perform(); } catch (Exception ignored) {}
        try {
            ((JavascriptExecutor) driver).executeScript(
                    "arguments[0].scrollIntoView({block:'center', inline:'center'});", el);
        } catch (Exception ignored) {}
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) {}
    }

    private static final String JS_VISIBLE_TILE_COUNT =
            "const sel = arguments[0];" +
            "const tiles = Array.from(document.querySelectorAll(sel))" +
            " .filter(e => e && e.offsetParent !== null);" +
            "return tiles.length;";

    private static final String JS_GET_4TH_TILE_HREF =
            "const sel = arguments[0];" +
            "const tiles = Array.from(document.querySelectorAll(sel))" +
            " .filter(e => e && e.offsetParent !== null);" +
            "if (tiles.length < 4) return null;" +
            "const t = tiles[3];" +
            "function findAnchorHref(tile) {" +
            "  const a = tile.querySelector(\"a[href*='/p/']\");" +
            "  if (a && a.href) return a.href;" +
            "  let el = tile;" +
            "  while (el && el !== document.body) {" +
            "    if (el.tagName && el.tagName.toLowerCase() === 'a'" +
            "        && el.href && el.href.indexOf('/p/') !== -1) return el.href;" +
            "    el = el.parentElement;" +
            "  }" +
            "  return null;" +
            "}" +
            "return findAnchorHref(t);";
}