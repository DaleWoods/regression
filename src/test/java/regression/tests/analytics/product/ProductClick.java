package regression.tests.analytics.product;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import regression.tests.ScreenshotWatcher;
import regression.tests.TestBase;

import regression.pages.MensWatchesPLP;

import regression.analytics.util.AssertLog;
import regression.analytics.util.DataLayerWait;
import regression.analytics.util.PdpInfoExtractor;
import regression.analytics.util.PdpInfoExtractor.PdpInfo;

import regression.utils.CookieConsent;
import regression.utils.CsvReader;

import java.nio.file.Paths;
import java.time.Duration;
import java.util.*;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(ScreenshotWatcher.class)
public class ProductClick extends TestBase {

    @Test
    void productClick_listenerCapture_validation() throws Exception {

        // --- Load PLP URL from CSV ---
        String csvPath = Paths.get("src","test","resources","testdata","plp_urls.csv").toString();
        List<String[]> rows = CsvReader.readCsv(csvPath);
        assertNotNull(rows, "CSV rows null");
        assertTrue(rows.size() >= 2, "CSV missing data row");

        String[] header = rows.get(0);
        String[] row    = rows.get(1);
        Map<String,String> data = toRowMap(header, row);

        String plpUrl       = data.get("plpUrl");
        String expectedList = opt(data, "expectedList");

        // --- SAFETY CHECK (prevents NPE if CSV header is wrong) ---
        assertNotNull(plpUrl, "plpUrl from CSV is NULL — check plp_urls.csv header is exactly 'plpUrl'");
        AssertLog.info("Resolved PLP URL: " + plpUrl);

        // --- Open PLP ---
        driver.get(plpUrl);
        CookieConsent.acceptIfPresent(driver);

        MensWatchesPLP plp = new MensWatchesPLP(driver);

        // --- Install listener BEFORE clicking (captures click-time pushes if any) ---
        plp.installDataLayerListenerOnPlp();
        AssertLog.info("Installed dataLayer listener on PLP");

        // --- Click product (normal, navigation to PDP) ---
        String clickedHref = plp.clickRandomTile_GoToPdp_ForAnalytics(4);
        AssertLog.info("Navigated to PDP: " + driver.getCurrentUrl());

        // --- Also ensure a listener exists on PDP (idempotent; harmless) ---
        DataLayerWait.installDataLayerListener(driver);

        // --- Combined strategy: PDP first, then buffer fallback ---
        Map<String,Object> evt = DataLayerWait.waitForProductClickCombined(
                driver,
                Duration.ofSeconds(10),   // PDP poll timeout
                false                     // we've just installed listener; no need to re-install
        );

        // --- If still null, print diagnostics and fail once ---
        if (evt == null) {
            System.out.println(DataLayerWait.dumpDataLayerTail(driver, 30));
            System.out.println(DataLayerWait.dumpCapturedTail(driver, 30));
        }

        AssertLog.check("productClick event located (PDP dataLayer or listener buffer)",
                evt != null, "productClick not found on PDP or in captured buffer");

        // --- VALIDATIONS ---
        runChecks(evt, expectedList, clickedHref);
    }

    /* ===================== VALIDATION LOGIC ===================== */

    private void runChecks(Map<String,Object> evt,
                           String expectedList,
                           String clickedHref) {

        // Top-level
        AssertLog.check("event == productClick",
                "productClick".equals(evt.get("event")),
                "event mismatch");

        AssertLog.check("eventCategory == Product clicks",
                "Product clicks".equals(evt.get("eventCategory")),
                "eventCategory mismatch");

        AssertLog.check("session_id present",
                evt.get("session_id") != null &&
                        !String.valueOf(evt.get("session_id")).isBlank(),
                "session_id missing");

        // ecommerce.click.actionField
        Map<String,Object> ecommerce = obj(evt, "ecommerce");
        Map<String,Object> click     = obj(ecommerce, "click");
        Map<String,Object> action    = obj(click, "actionField");

        if (!isBlank(expectedList)) {
            AssertLog.check("actionField.list matches expected",
                    expectedList.equals(action.get("list")),
                    "actionField.list mismatch");
        } else {
            AssertLog.info("actionField.list: " + action.get("list"));
        }

        // products[0]
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> products =
                (List<Map<String,Object>>) click.get("products");

        assertNotNull(products, "products missing");
        assertFalse(products.isEmpty(), "products empty");

        Map<String,Object> p = products.get(0);

        String dlName = s(p.get("name"));
        String dlId   = s(p.get("id"));
        String frId   = s(p.get("fr_product_id"));

        AssertLog.check("name present", !dlName.isBlank(), "product name blank");
        AssertLog.check("id numeric", dlId.matches("\\d+"), "id not numeric");

        AssertLog.check("fr_product_id == p + id",
                frId.equals("p" + dlId), "fr_product_id mismatch");

        AssertLog.check("source_id present",
                p.get("source_id") != null && !s(p.get("source_id")).isBlank(),
                "source_id missing");

        Object priceObj = p.get("price");
        AssertLog.check("price numeric", priceObj instanceof Number, "price not numeric");
        long dlPrice = Math.round(((Number)priceObj).doubleValue());

        AssertLog.check("brand present",
                p.get("brand") != null && !s(p.get("brand")).isBlank(),
                "brand missing");

        AssertLog.check("position int-like",
                isIntLike(s(p.get("position"))), "position invalid");

        // PDP cross-checks
        PdpInfo info = new PdpInfoExtractor(driver).extract();

        AssertLog.check("PDP name extracted",
                info.name != null && !info.name.isBlank(),
                "PDP name missing");

        AssertLog.check("Names match (normalized)",
                normalize(dlName).equals(normalize(info.name)),
                "name mismatch");

        AssertLog.check("PDP id extracted",
                info.idFromUrl != null && !info.idFromUrl.isBlank(),
                "PDP URL id missing");

        AssertLog.check("DL id == PDP id",
                dlId.equals(info.idFromUrl), "id mismatch");

        long expected = Math.round(info.pricePounds * 100);
        AssertLog.check("Price == PDP price × 100",
                dlPrice == expected,
                "price mismatch; DL=" + dlPrice + ", expected=" + expected);

        // Optional: clicked href id vs PDP id
        if (!isBlank(clickedHref)) {
            String clickedId = idFromUrl(clickedHref);
            if (!isBlank(clickedId)) {
                AssertLog.check("Clicked href ID == PDP ID",
                        clickedId.equals(info.idFromUrl),
                        "href id mismatch");
            }
        }

        AssertLog.info("All checks passed ✔");
    }

    /* ===================== HELPERS ===================== */

    private static Map<String,String> toRowMap(String[] h, String[] r) {
        Map<String,String> m = new HashMap<>();
        for (int i = 0; i < Math.min(h.length, r.length); i++) {
            m.put(h[i].trim(), r[i].trim());
        }
        return m;
    }

    private static String opt(Map<String,String> m, String k) {
        String v = m.get(k);
        return v == null ? "" : v.trim();
    }

    private static String s(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static boolean isIntLike(String s) {
        try { Integer.parseInt(s); return true; }
        catch (Exception e) { return false; }
    }

    private static String normalize(String s) {
        return s == null ? "" : s.replaceAll("\\s+"," ").trim();
    }

    private static String idFromUrl(String url) {
        var m = Pattern.compile("/p/(\\d+)").matcher(url == null ? "" : url);
        return m.find() ? m.group(1) : "";
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> obj(Map<String,Object> parent, String key) {
        Object v = parent.get(key);
        assertNotNull(v, "Missing object: " + key);
        assertTrue(v instanceof Map, key + " is not an object");
        return (Map<String,Object>) v;
    }
}