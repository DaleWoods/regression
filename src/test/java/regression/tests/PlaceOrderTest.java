package regression.tests;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import regression.pages.Cart;
import regression.pages.CheckoutPage1;
import regression.pages.CheckoutPage2;
import regression.pages.CheckoutPage3;
import regression.pages.Homepage;
import regression.pages.MiniBag;
import regression.pages.MensWatchesPLP;
import regression.pages.OrderConfirmation;
import regression.pages.PDP;
import regression.pages.MenWatches;
import regression.utils.CsvReader;
import regression.utils.CookieConsent;
/**
 * PlaceOrderTest
 *
 * Purpose:
 *  - Drive a complete “browse → add to bag → checkout → pay → confirm” journey using Page Objects.
 *  - Parameterise the flow by reading rows from a CSV (one order per row).
 *
 * High-level flow:
 *  1) Load site root and accept cookie consent (best-effort).
 *  2) Navigate Home → Watches → Men’s Watches PLP (robust fallbacks).
 *  3) Open a PDP, add to bag, use mini-bag to proceed to cart.
 *  4) Cart → Checkout Page 1 (guest email) → Page 2 (details + address finder) → Page 3 (card payment).
 *  5) Wait for order confirmation and assert an order reference is present.
 *
 * Notes:
 *  - This class intentionally keeps assertions minimal and focused on key checkpoints (CSV sanity, address summary, order ref).
 *  - ScreenshotWatcher is attached to capture failures at any phase (@BeforeEach/@Test/@AfterEach).
 */
@ExtendWith(ScreenshotWatcher.class)
public class PlaceOrderTest extends TestBase {

    // Path to the CSV that supplies one or more orders (header optional).
    private static final String CSV_PATH = "src/test/resources/testdata/order_data.csv";

    /**
     * Reads all rows from the CSV and executes the full order journey for each row.
     *
     * CSV format (11 columns):
     *   email,title,firstName,lastName,phone,street,city,postcode,card_number,expiry,cvv
     *
     * Behaviour:
     *  - Skips a header row if the first cell equals "email" (case-insensitive).
     *  - Validates minimum column count (11) and throws with detail if insufficient.
     *  - Delegates the actual browser steps to runSimpleOrderJourney(String[] r).
     *
     * Why per-row execution:
     *  - Keeps each order independent and makes it easy to add/remove data without code changes.
     */
    @Test
    void placeOrders_FromCsv() throws IOException {
        // Load all rows from CSV. CsvReader handles blank lines and trims fields.
        List<String[]> rows = CsvReader.readCsv(CSV_PATH);

        // Basic guardrail: ensure we actually have data to run.
        if (rows == null || rows.isEmpty()) {
            throw new IllegalStateException("CSV empty/not found: " + CSV_PATH);
        }

        // Optional header handling: drop first row if it looks like a header.
        if (rows.get(0)[0].equalsIgnoreCase("email")) rows.remove(0);

        // Execute one end-to-end flow per row.
        for (String[] r : rows) {
            // Defensive check so we fail early with a clear message if the CSV is malformed.
            if (r.length < 11) {
                throw new IllegalArgumentException(
                    "CSV requires 11 columns. Got: " + r.length + " Row: " + Arrays.toString(r)
                );
            }
            runSimpleOrderJourney(r);
        }
    }

    /**
     * Runs the full order placement journey for a single CSV row.
     *
     * Parameters mapping:
     *   r[0]=email, r[1]=title, r[2]=first, r[3]=last, r[4]=phone,
     *   r[5]=street, r[6]=city, r[7]=postcode, r[8]=cardNo, r[9]=expiry, r[10]=cvv
     *
     * Key assertions:
     *  - Card number appears sufficiently long after stripping non-digits (helps catch CSV quoting issues).
     *  - Address summary contains the expected postcode (normalised) after AFD selection/confirmation.
     *  - Order confirmation exposes a non-null order reference.
     *
     * Side effects:
     *  - Navigates across multiple pages and performs real interactions using the POMs.
     */
    private void runSimpleOrderJourney(String[] r) {
        // ----------------------------
        // Extract and name CSV fields
        // ----------------------------
        String email = r[0];
        String title = r[1];
        String first = r[2];
        String last = r[3];
        String phone = r[4];
        String street = r[5];
        String city = r[6];
        String postcode = r[7];
        String cardNo = r[8];
        String expiry = r[9];
        String cvv = r[10];

        // Debug aid: shows the raw card value read from CSV.
        // If you see missing digits, quote the value in the CSV to prevent parsing issues.
        System.out.println("[PlaceOrderTest] CSV cardNo raw: " + cardNo);

        // Guard against truncated/unquoted PAN in CSV by asserting a minimal length post-sanitisation.
        String digitsOnly = cardNo == null ? "" : cardNo.replaceAll("[^0-9]", "");
        assertTrue(digitsOnly.length() >= 14,
            "Card number looks truncated from CSV. Got: " + cardNo +
            " (digitsOnly length=" + digitsOnly.length() + "). " +
            "Put the card number in quotes in order_data.csv.");

        // ----------------------------
        // 1) Open site + handle cookie consent
        // ----------------------------
        driver.get("https://goldsmiths-uat.thewosgroup.com");
        CookieConsent.acceptIfPresent(driver);

        // ----------------------------
        // 2) Navigate to Men's Watches PLP
        // ----------------------------
        Homepage homepage = new Homepage(driver);
        homepage.goToWatches();

        MenWatches watches = new MenWatches(driver);
        watches.goToMensWatchesPLP();

        // ----------------------------
        // 3) Pick a product and add to bag
        // ----------------------------
        MensWatchesPLP plp = new MensWatchesPLP(driver);
        plp.selectFourthProduct(); // Uses JS to resolve anchor href to avoid click/stale issues

        PDP pdp = new PDP(driver);
        pdp.addToBag();

        // ----------------------------
        // 4) Mini-bag → Cart
        // ----------------------------
        MiniBag mini = new MiniBag(driver);
        mini.open(); // Opens drawer if not already open
        mini.waitUntilOpen(java.time.Duration.ofSeconds(15)); // brief settle to allow animation/mount
        mini.clickViewShoppingBag(); // Navigates to cart

        // ----------------------------
        // 5) Cart → Checkout
        // ----------------------------
        Cart cart = new Cart(driver);
        cart.checkoutSecurely();

        // ----------------------------
        // 6) Checkout Page 1 (guest email)
        // ----------------------------
        CheckoutPage1 cp1 = new CheckoutPage1(driver);
        cp1.enterEmail(email);
        cp1.continueAsGuest();

        // ----------------------------
        // 7) Checkout Page 2 (details + address)
        // ----------------------------
        CheckoutPage2 cp2 = new CheckoutPage2(driver);
        cp2.enterPersonalDetails(title, first, last, phone);
        cp2.enterAddressFinderSearch(postcode);     // triggers AFD suggestions
        cp2.selectFirstAddressSuggestion();         // selects first suggestion
        cp2.confirmAddress();                       // confirm/finalise address if button present (soft)

        // ---- Robust postcode assertion (normalised) ----
        // After AFD selection, a summary block should show the chosen address.
        String addrSummary = cp2.getConfirmedAddressText();
        assertNotNull(addrSummary, "Address summary must be visible after selecting address.");

        // Normalise both expected and actual to be resilient to formatting (spaces, case, punctuation).
        String expectedPc = normalisePostcode(postcode);
        String summaryFlat = normalisePostcode(addrSummary);

        // Ensure the summary contains our postcode (indicates AFD selection took effect).
        assertTrue(
            summaryFlat.contains(expectedPc),
            "Address summary should contain postcode: " + postcode +
            "\n\nSummary (raw):\n" + addrSummary +
            "\n\nNormalised summary: " + summaryFlat +
            "\nNormalised expected : " + expectedPc
        );
        // -----------------------------------------------

        // ----------------------------
        // 8) Checkout Page 3 (payment)
        // ----------------------------
        cp2.continueToPayment();

        CheckoutPage3 cp3 = new CheckoutPage3(driver);
        cp3.selectCreditDebitCard();           // ensures card iframe(s) are mounted/ready
        cp3.enterCardDetails(cardNo, expiry, cvv); // tolerant parsing of expiry formats (e.g., "Mar-30", "03/30")
        cp3.payByCard();                       // waits for button to become enabled/clickable

        // ----------------------------
        // 9) Confirmation
        // ----------------------------
        OrderConfirmation conf = new OrderConfirmation(driver);
        conf.waitForConfirmationPage();
        assertNotNull(conf.getOrderReference(), "Order reference should be present");
        conf.waitFiveSecondsBeforeClose(); // per test plan, brief dwell for visual check/logs
    }

    /** Remove spaces, punctuation, newlines; make uppercase. */
    private String normalisePostcode(String s) {
        if (s == null) return "";
        return s.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }
}