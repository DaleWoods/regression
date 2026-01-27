package regression.tests;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.WebDriver;
import regression.utils.DriverFactory;

public abstract class TestBase {

    protected WebDriver driver;

    @BeforeEach
    public void setUp() {
        driver = DriverFactory.createDriver();   // Chrome via your DriverFactory
        driver.manage().window().maximize();
    }

    @AfterEach
    public void tearDown() {
        // Toggle with: -DkeepBrowser=true (default is false)
        boolean keep = Boolean.parseBoolean(System.getProperty("keepBrowser", "false"));

        if (keep) {
            System.out.println("[TestBase] keepBrowser=true -> Leaving the browser open for debugging.");
            // Do NOT quit. You can close manually after inspecting.
            return;
        }

        if (driver != null) {
            driver.quit();
        }
    }
}