package regression.pages;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import regression.utils.WaitUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Checkout Page 2
 * - Personal details
 * - Address Finder (AFD)
 * - Manual address entry (legacy)
 * - Address summary assertion support
 */
public class CheckoutPage2 {
    private final WebDriver driver;
    private final WaitUtils wait;

    // ============================ 2.1 PERSONAL DETAILS ============================
    private final By titleField     = By.xpath("//select[contains(@name,'title') or contains(@id,'title')]");
    private final By firstNameField = By.xpath("//input[contains(@name,'first') or contains(@id,'first')]");
    private final By lastNameField  = By.xpath("//input[contains(@name,'last')  or contains(@id,'last')]");
    private final By phoneField     = By.xpath("//input[contains(@name,'phone') or contains(@id,'phone') or contains(@type,'tel')]");

    // ============================ 2.2 ADDRESS FINDER (AFD) ============================
    private final List<By> addressFinderInputs = Arrays.asList(
        By.cssSelector("input.spAddressLookup"),
        By.cssSelector("input.afd-typeahead, input.afd-typeahead-input"),
        By.xpath("//input[contains(@placeholder,'Start typing') or " +
                 "contains(@aria-label,'address') or contains(@id,'afd') or " +
                 "contains(@class,'afd') or contains(@class,'address')]")
    );

    private final List<By> suggestionLists = Arrays.asList(
        By.cssSelector("ul.afd-typeahead-list"),
        By.cssSelector(".afd-typeahead-list")
    );

    private final List<By> suggestionItems = Arrays.asList(
        By.cssSelector("ul.afd-typeahead-list li"),
        By.cssSelector(".afd-typeahead-list .afd-typeahead-item"),
        By.xpath("//ul[contains(@class,'afd-typeahead')]//li | //li[contains(@class,'afd-typeahead')]")
    );

    // ============================ 2.2 MANUAL ADDRESS (legacy) ============================
    private final By enterAddressManuallyButton =
            By.xpath("//button[contains(.,'Enter address manually') or contains(.,'Enter Address Manually')]");
    private final By streetField   = By.xpath("//input[contains(@name,'street') or contains(@name,'address') or contains(@id,'street') or contains(@id,'address')]");
    private final By cityField     = By.xpath("//input[contains(@name,'city') or contains(@id,'city')]");
    private final By postcodeField = By.xpath("//input[contains(@name,'postcode') or contains(@name,'postal') or contains(@id,'postcode') or contains(@id,'postal')]");
    private final By confirmAddressButton =
            By.xpath("//button[contains(.,'Confirm Address') or contains(.,'Confirm address')]");

    // ============================ ADDRESS SUMMARY ============================
    private final List<By> addressSummaryLocators = Arrays.asList(
        By.cssSelector("div[id*='AddressSummary']"),
        By.cssSelector(".spAddressSummary"),
        By.cssSelector(".spDeliveryAddressSummary")
    );

    // ============================ 2.3 CONTINUE ============================
    private final By continueToPaymentButton =
            By.xpath("//button[contains(.,'Continue to Payment') or contains(.,'Continue to payment')]");

    public CheckoutPage2(WebDriver driver) {
        this.driver = driver;
        this.wait = new WaitUtils(driver);
    }

    // ============================ PERSONAL DETAILS ============================
    public void enterPersonalDetails(String title, String firstName, String lastName, String phone) {
        wait.waitForPageLoad();
        wait.waitForClickable(titleField).sendKeys(title);
        wait.waitForClickable(firstNameField).sendKeys(firstName);
        wait.waitForClickable(lastNameField).sendKeys(lastName);
        wait.waitForClickable(phoneField).sendKeys(phone);
    }

    // ============================ ADDRESS FINDER ============================
    public void enterAddressFinderSearch(String query) {
        wait.waitForPageLoad();
        WebElement input = waitForFirstClickable(addressFinderInputs, Duration.ofSeconds(15));
        if (input == null) {
            throw new NoSuchElementException("Address finder input not found with any known locator.");
        }

        try { input.clear(); } catch (InvalidElementStateException ignored) {}
        input.sendKeys(query);

        waitForVisibleAny(suggestionLists, Duration.ofSeconds(10));
    }

    public void selectFirstAddressSuggestion() {
        WebElement first = waitForFirstVisible(suggestionItems, Duration.ofSeconds(10));
        if (first == null) {
            throw new TimeoutException("No address suggestions appeared.");
        }
        try {
            first.click();
        } catch (ElementClickInterceptedException | JavascriptException e) {
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", first);
        }

        // Wait for AFD auto-fill OR confirm button
        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(10));
        try {
            w.until(ExpectedConditions.elementToBeClickable(confirmAddressButton));
        } catch (Exception ignored) {
            try {
                WebElement pc = driver.findElement(postcodeField);
                w.until(d -> {
                    try { return pc.getAttribute("value") != null && !pc.getAttribute("value").isBlank(); }
                    catch (StaleElementReferenceException e) { return false; }
                });
            } catch (Exception ignored2) {}
        }
    }

    // ============================ ADDRESS SUMMARY ACCESSOR ============================
    public String getConfirmedAddressText() {
        WebDriverWait w = new WebDriverWait(driver, Duration.ofSeconds(10));

        for (By by : addressSummaryLocators) {
            try {
                WebElement el = w.until(ExpectedConditions.visibilityOfElementLocated(by));
                return el.getText().trim();
            } catch (Exception ignored) {}
        }

        throw new NoSuchElementException("Address summary block not found.");
    }

    // ============================ MANUAL ADDRESS ============================
    public void enterAddressManually() {
        wait.waitForClickable(enterAddressManuallyButton).click();
        wait.waitForPageLoad();
    }

    public void enterAddress(String street, String city, String postcode) {
        wait.waitForClickable(streetField).sendKeys(street);
        wait.waitForClickable(cityField).sendKeys(city);
        wait.waitForClickable(postcodeField).sendKeys(postcode);
    }

    public void confirmAddress() {
        try {
            WebElement btn = new WebDriverWait(driver, Duration.ofSeconds(6))
                    .until(ExpectedConditions.elementToBeClickable(confirmAddressButton));
            btn.click();
            wait.waitForPageLoad();
        } catch (TimeoutException ignored) {}
    }

    public void waitFiveSeconds() {
        try { Thread.sleep(5000); } catch (InterruptedException ignored) {}
    }

    // ============================ CONTINUE ============================
    public void continueToPayment() {
        wait.waitForClickable(continueToPaymentButton).click();
        wait.waitForPageLoad();
    }

    // ============================ PRIVATE HELPERS ============================
    private WebElement waitForFirstClickable(List<By> locators, Duration timeout) {
        WebDriverWait w = new WebDriverWait(driver, timeout);
        for (By by : locators) {
            try { return w.until(ExpectedConditions.elementToBeClickable(by)); }
            catch (Exception ignored) {}
        }
        return null;
    }

    private void waitForVisibleAny(List<By> locators, Duration timeout) {
        WebDriverWait w = new WebDriverWait(driver, timeout);
        for (By by : locators) {
            try { w.until(ExpectedConditions.visibilityOfElementLocated(by)); return; }
            catch (Exception ignored) {}
        }
    }

    private WebElement waitForFirstVisible(List<By> locators, Duration timeout) {
        WebDriverWait w = new WebDriverWait(driver, timeout);
        for (By by : locators) {
            try {
                w.until(ExpectedConditions.presenceOfAllElementsLocatedBy(by));
                List<WebElement> items = driver.findElements(by);
                for (WebElement el : items) {
                    if (el.isDisplayed()) return el;
                }
            } catch (Exception ignored) {}
        }
        return null;
    }
}