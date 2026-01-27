package regression.analytics.util;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PdpInfoExtractor {

    private final WebDriver driver;
    private final WebDriverWait wait;

    public PdpInfoExtractor(WebDriver driver) {
        this.driver = driver;
        this.wait   = new WebDriverWait(driver, Duration.ofSeconds(15));
    }

    public PdpInfo extract() {

        // Wait for document readiness
        wait.until(d ->
                ((JavascriptExecutor)d)
                        .executeScript("return document.readyState")
                        .equals("complete")
        );

        PdpInfo info = new PdpInfo();

        // 1) Try datalayerProduct
        try {
            WebElement dl = wait.until(ExpectedConditions.presenceOfElementLocated(
                    By.cssSelector(".datalayerProduct, .datalayer.datalayerProduct")
            ));

            info.name  = dl.getAttribute("data-product-name");
            info.brand = dl.getAttribute("data-product-brand");
            info.pricePounds = parsePrice(dl.getAttribute("data-product-price"));
        }
        catch (Exception ignored) {}

        // 2) Fallback title
        if (isBlank(info.name)) {
            try {
                info.name = driver.findElement(
                        By.cssSelector("h1, [data-test*='product-title']")
                ).getText().trim();
            }
            catch (Exception ignored) {}
        }

        // 3) Extract ID from URL
        info.idFromUrl = extractIdFromUrl(driver.getCurrentUrl());

        return info;
    }

    private static String extractIdFromUrl(String url) {
        Matcher m = Pattern.compile("/p/(\\d+)").matcher(url);
        return m.find() ? m.group(1) : null;
    }

    private static double parsePrice(String s) {
        if (s == null) return Double.NaN;
        s = s.replace(",","").trim();
        try { return Double.parseDouble(s); }
        catch (Exception e) { return Double.NaN; }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    public static class PdpInfo {
        public String name;
        public String brand;
        public String idFromUrl;
        public double pricePounds = Double.NaN;
    }
}