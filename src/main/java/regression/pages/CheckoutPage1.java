package regression.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import regression.utils.WaitUtils;

/**
 * Minimal Checkout Page 1.
 * - Enter email and click "Continue as guest".
 */
public class CheckoutPage1 {

    private final WebDriver driver;
    private final WaitUtils wait;

    // Locators
    private final By emailInput = By.xpath("//input[@type='email']");
    private final By continueAsGuestButton = By.xpath(
        "//button[contains(., 'Continue as guest') or contains(., 'Continue as a guest')]"
    );

    public CheckoutPage1(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    /** Enter email address in the input field. */
    public void enterEmail(String email) {
        wait.waitForPageLoad();
        wait.waitForClickable(emailInput).sendKeys(email);
    }

    /** Click "Continue as guest" and wait for next page. */
    public void continueAsGuest() {
        wait.waitForClickable(continueAsGuestButton).click();
        wait.waitForPageLoad();
    }
}