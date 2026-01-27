package regression.analytics.util;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@SuppressWarnings("unchecked")
public final class DataLayerWait {

    private DataLayerWait() {}

    // Messages Selenium throws while the document/frame is swapping
    private static final Pattern TRANSIENT_STALE =
            Pattern.compile("(stale element reference|detached frame|not found in the current frame|no such window)",
                    Pattern.CASE_INSENSITIVE);

    /* ---------------- Listener install (PLP or PDP) ---------------- */

    /** Install a listener that records all pushes into window.__dlEvents (idempotent). */
    public static void installDataLayerListener(WebDriver driver) {
        String script =
                "window.dataLayer = window.dataLayer || [];" +
                "if (!window.__dlEvents) window.__dlEvents = [];" +
                "if (!window.__dlListenerInstalled) {" +
                "  window.__dlListenerInstalled = true;" +
                "  const orig = window.dataLayer.push;" +
                "  window.dataLayer.push = function() {" +
                "    try { window.__dlEvents.push(arguments[0]); } catch(e) {}" +
                "    return orig.apply(this, arguments);" +
                "  };" +
                "}";
        ((JavascriptExecutor)driver).executeScript(script);
    }

    /* ---------------- Captured buffer (listener) ---------------- */

    /** Returns ALL captured events since listener registration (navigation-safe). */
    public static List<Map<String,Object>> getCapturedEvents(WebDriver driver) {
        try {
            Object o = ((JavascriptExecutor)driver).executeScript("return window.__dlEvents || [];");
            if (o == null) return new ArrayList<>();
            return (List<Map<String,Object>>) o;
        } catch (WebDriverException e) {
            String msg = e.getMessage() == null ? "" : e.getMessage();
            if (TRANSIENT_STALE.matcher(msg).find()) return new ArrayList<>();
            return new ArrayList<>();
        }
    }

    /** Find first event with event=<eventName> in captured buffer. */
    public static Map<String,Object> findCapturedEvent(WebDriver driver, String eventName) {
        List<Map<String,Object>> evs = getCapturedEvents(driver);
        for (Map<String,Object> ev : evs) {
            if (eventName.equals(String.valueOf(ev.get("event")))) {
                return ev;
            }
        }
        return null;
    }

    /* ---------------- PDP-side resilient poll of window.dataLayer ---------------- */

    private static boolean isDocReady(WebDriver d) {
        try {
            Object rs = ((JavascriptExecutor)d).executeScript("return document.readyState");
            return "complete".equals(rs) || "interactive".equals(rs);
        } catch (WebDriverException e) {
            return false;
        }
    }

    /** Read window.dataLayer array; return null if not accessible yet. */
    private static List<Map<String,Object>> safeReadDataLayer(WebDriver d) {
        try {
            if (!isDocReady(d)) return null;
            Object r = ((JavascriptExecutor)d).executeScript(
                    "try { return (window && window.dataLayer) ? window.dataLayer : []; } catch(e){ return []; }");
            if (r == null) return null;
            return (List<Map<String,Object>>) r;
        } catch (WebDriverException e) {
            String msg = e.getMessage() == null ? "" : e.getMessage();
            if (TRANSIENT_STALE.matcher(msg).find()) return null;
            return null;
        }
    }

    /** Wait up to timeout for eventName to be present anywhere in window.dataLayer (PDP). */
    public static Map<String,Object> waitForEventFromDataLayer(WebDriver d, String eventName, Duration timeout) {
        Instant end = Instant.now().plus(timeout);
        while (Instant.now().isBefore(end)) {
            List<Map<String,Object>> dl = safeReadDataLayer(d);
            if (dl != null && !dl.isEmpty()) {
                for (int i = dl.size() - 1; i >= 0; i--) {
                    Map<String,Object> o = dl.get(i);
                    if (o != null && eventName.equals(String.valueOf(o.get("event")))) {
                        return o;
                    }
                }
            }
            sleep(120);
        }
        return null;
    }

    /* ---------------- Combined strategy & diagnostics ---------------- */

    /** Waits for productClick from PDP dataLayer; if absent, checks listener buffer; optional PDP listener install. */
    public static Map<String,Object> waitForProductClickCombined(WebDriver d,
                                                                 Duration pdpPollTimeout,
                                                                 boolean installListenerOnPdpIfMissing) {

        Map<String,Object> evt = waitForEventFromDataLayer(d, "productClick", pdpPollTimeout);
        if (evt != null) return evt;

        if (installListenerOnPdpIfMissing) {
            // Idempotent, harmless if already present
            installDataLayerListener(d);
        }

        // Fallback to captured buffer (in case site fires on PLP before nav)
        evt = findCapturedEvent(d, "productClick");
        return evt;
    }

    /** Dump the last N entries from window.dataLayer (for diagnostics). */
    public static String dumpDataLayerTail(WebDriver d, int lastN) {
        List<Map<String,Object>> dl = safeReadDataLayer(d);
        if (dl == null) return "<PDP dataLayer not readable>";
        int from = Math.max(0, dl.size() - lastN);
        StringBuilder sb = new StringBuilder();
        sb.append("PDP dataLayer tail (showing ").append(dl.size() - from).append(" of ").append(dl.size()).append(")\n");
        for (int i = from; i < dl.size(); i++) {
            sb.append("#").append(i).append(": ").append(mini(dl.get(i))).append("\n");
        }
        return sb.toString();
    }

    /** Dump the last N entries from captured buffer (listener). */
    public static String dumpCapturedTail(WebDriver d, int lastN) {
        List<Map<String,Object>> evs = getCapturedEvents(d);
        int from = Math.max(0, evs.size() - lastN);
        StringBuilder sb = new StringBuilder();
        sb.append("Captured buffer (__dlEvents) tail (showing ").append(evs.size() - from).append(" of ").append(evs.size()).append(")\n");
        for (int i = from; i < evs.size(); i++) {
            sb.append("#").append(i).append(": ").append(mini(evs.get(i))).append("\n");
        }
        return sb.toString();
    }

    private static String mini(Object o) {
        if (o == null) return "null";
        if (o instanceof Map<?,?> m) {
            StringBuilder sb = new StringBuilder("{");
            int c = 0;
            for (var e : m.entrySet()) {
                if (c++ > 0) sb.append(", ");
                sb.append(e.getKey()).append(":").append(mini(e.getValue()));
            }
            return sb.append("}").toString();
        } else if (o instanceof List<?> l) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < l.size(); i++) {
                if (i > 0) sb.append(", ");
                sb.append(mini(l.get(i)));
            }
            return sb.append("]").toString();
        } else {
            String s = String.valueOf(o);
            if (s.length() > 200) s = s.substring(0, 200) + "…";
            return "\"" + s.replace("\n"," ").replace("\r"," ") + "\"";
        }
    }

    private static void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
    }
}