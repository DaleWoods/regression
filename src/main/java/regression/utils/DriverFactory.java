package regression.utils;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

/**
 * Minimal DriverFactory for creating a Chrome WebDriver.
 * - Uses Selenium Manager (Selenium 4.6+) to resolve the driver automatically.
 * - Headless can be toggled with -Dheadless=true
 *
 * Example:
 *   WebDriver driver = DriverFactory.createDriver();
 */
public final class DriverFactory {

    private DriverFactory() {
        // prevent instantiation
    }

    /**
     * Creates and returns a Chrome WebDriver instance.
     * Headless mode can be enabled by adding JVM arg: -Dheadless=true
     */
    public static WebDriver createDriver() {
        ChromeOptions options = new ChromeOptions();

        // Toggle headless with: -Dheadless=true
        if (Boolean.parseBoolean(System.getProperty("headless", "false"))) {
            options.addArguments("--headless=new");
        }

        // Keep it simple; a few stability flags
        options.addArguments("--disable-notifications");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--no-sandbox");

        // Create driver (Selenium Manager resolves chromedriver automatically on Selenium 4.6+)
        return new ChromeDriver(options);
    }
}