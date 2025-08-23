// TrueCost Content Script - Fee Detection Engine

class TrueCostDetector {
  constructor() {
    this.priceData = {
      basePrice: 0,
      deliveryFee: 0,
      convenienceFee: 0,
      taxes: 0,
      otherFees: 0,
      total: 0,
      hiddenCharges: 0,
      hiddenPercentage: 0,
      currency: "₹",
      site: window.location.hostname,
      breakdown: [],
    }

    this.priceSelectors = this.initializePriceSelectors()
    this.isAnalyzing = false
    this.hasShownPopup = false // Track if popup was already shown
    this.analysisCount = 0 // Track analysis attempts
    this.notificationManager = new NotificationManager()
    this.paymentMethodDetected = false
    this.finalAmountDetected = false
    this.paymentMethods = []
    this.init()
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.startMonitoring())
    } else {
      this.startMonitoring()
    }

    this.observePageChanges()
  }

  startMonitoring() {
    console.log("[TrueCost] Starting payment monitoring on:", window.location.href)

    this.monitoringInterval = setInterval(() => {
      this.checkPaymentMethods()
      this.checkFinalAmount()

      if (this.shouldTriggerAnalysis()) {
        clearInterval(this.monitoringInterval)
        this.startAnalysis()
      }
    }, 1000)

    setTimeout(() => {
      if (!this.hasShownPopup) {
        clearInterval(this.monitoringInterval)
        this.startAnalysis()
      }
    }, 10000)
  }

  checkPaymentMethods() {
    const paymentSelectors = [
      'input[type="radio"][name*="payment"]',
      'input[type="radio"][name*="paymentMethod"]',
      ".payment-method.selected",
      ".payment-option.active",
      '[data-testid*="payment"]:checked',
      ".selected-payment",
      ".payment-selected",
    ]

    for (const selector of paymentSelectors) {
      const elements = document.querySelectorAll(selector)
      if (elements.length > 0) {
        elements.forEach((element) => {
          if (element.checked || element.classList.contains("selected") || element.classList.contains("active")) {
            this.paymentMethodDetected = true
            this.detectAvailablePaymentMethods()
            console.log("[TrueCost] Payment method detected")
            return
          }
        })
      }
    }

    const paymentTexts = ["Payment Method Selected", "Selected Payment", "Pay with", "Payment via"]
    paymentTexts.forEach((text) => {
      if (document.body.textContent.includes(text)) {
        this.paymentMethodDetected = true
        this.detectAvailablePaymentMethods()
      }
    })
  }

  detectAvailablePaymentMethods() {
    this.paymentMethods = []

    const paymentOptions = document.querySelectorAll(
      [".payment-method", ".payment-option", '[data-testid*="payment"]', 'input[name*="payment"]'].join(","),
    )

    paymentOptions.forEach((option) => {
      const text = option.textContent || option.value || option.getAttribute("data-payment-type") || ""
      const fees = this.extractPaymentMethodFees(option)

      if (text.trim()) {
        this.paymentMethods.push({
          name: text.trim(),
          element: option,
          fees: fees,
          isSelected: option.checked || option.classList.contains("selected") || option.classList.contains("active"),
        })
      }
    })
  }

  extractPaymentMethodFees(element) {
    const parent = element.closest(".payment-method, .payment-option, .payment-container") || element.parentElement
    const text = parent ? parent.textContent : element.textContent

    const feeMatch = text.match(/[+]?\s*[₹$€£¥]\s*(\d+\.?\d*)|(\d+\.?\d*)\s*[₹$€£¥]/g)
    return feeMatch ? feeMatch.map((fee) => this.parsePrice(fee)) : [0]
  }

  checkFinalAmount() {
    const finalAmountSelectors = [
      ".final-amount",
      ".grand-total",
      ".total-amount",
      ".checkout-total",
      '[data-testid*="final"]',
      '[data-testid*="grand-total"]',
      ".order-total",
    ]

    for (const selector of finalAmountSelectors) {
      const elements = document.querySelectorAll(selector)
      if (elements.length > 0) {
        elements.forEach((element) => {
          const amount = this.extractPriceFromElement(element)
          if (amount > 0) {
            this.finalAmountDetected = true
            console.log("[TrueCost] Final amount detected:", amount)
            return
          }
        })
      }
    }

    const totalTexts = ["Total:", "Grand Total:", "Final Amount:", "Order Total:"]
    totalTexts.forEach((text) => {
      if (document.body.textContent.includes(text)) {
        this.finalAmountDetected = true
      }
    })
  }

  shouldTriggerAnalysis() {
    return (
      (this.paymentMethodDetected && this.finalAmountDetected) ||
      (this.paymentMethodDetected && this.analysisCount === 0) ||
      (this.finalAmountDetected && this.analysisCount === 0)
    )
  }

  initializePriceSelectors() {
    return {
      // Common price selectors across different sites
      basePrice: [
        '[data-testid*="price"]',
        '[class*="base-price"]',
        '[class*="item-price"]',
        '[class*="product-price"]',
        '[class*="subtotal"]',
        '.price:not([class*="total"])',
        '.amount:not([class*="total"])',
        '[id*="subtotal"]',
        '[id*="item-price"]',
      ],

      deliveryFee: [
        '[class*="delivery"]',
        '[class*="shipping"]',
        '[data-testid*="delivery"]',
        '[data-testid*="shipping"]',
        '[id*="delivery"]',
        '[id*="shipping"]',
      ],

      convenienceFee: [
        '[class*="convenience"]',
        '[class*="handling"]',
        '[class*="processing"]',
        '[class*="service"]',
        '[data-testid*="convenience"]',
        '[data-testid*="handling"]',
      ],

      taxes: ['[class*="tax"]', '[class*="gst"]', '[class*="vat"]', '[data-testid*="tax"]', '[id*="tax"]'],

      total: [
        '[class*="total"]',
        '[class*="grand-total"]',
        '[class*="final-amount"]',
        '[data-testid*="total"]',
        '[id*="total"]',
      ],
    }
  }

  startAnalysis() {
    if (this.isAnalyzing) return
    this.isAnalyzing = true
    this.analysisCount++

    console.log("[TrueCost] Starting fee analysis #" + this.analysisCount + " on:", window.location.href)

    setTimeout(() => {
      this.analyzePage()
    }, 2000)
  }

  analyzePage() {
    try {
      this.resetPriceData()

      this.extractPrices()

      this.calculateHiddenCharges()

      this.sendResults()

      console.log("[TrueCost] Analysis complete:", this.priceData)
    } catch (error) {
      console.error("[TrueCost] Analysis error:", error)
      this.sendError(error.message)
    }
  }

  resetPriceData() {
    this.priceData = {
      basePrice: 0,
      deliveryFee: 0,
      convenienceFee: 0,
      taxes: 0,
      otherFees: 0,
      total: 0,
      hiddenCharges: 0,
      hiddenPercentage: 0,
      currency: "₹",
      site: window.location.hostname,
      breakdown: [],
    }
  }

  extractPrices() {
    this.priceData.basePrice = this.findPrice("basePrice", "Base Price")

    this.priceData.deliveryFee = this.findPrice("deliveryFee", "Delivery Fee")

    this.priceData.convenienceFee = this.findPrice("convenienceFee", "Convenience Fee")

    this.priceData.taxes = this.findPrice("taxes", "Taxes")

    this.priceData.total = this.findPrice("total", "Total")

    if (this.priceData.basePrice === 0 && this.priceData.total > 0) {
      this.priceData.basePrice =
        this.priceData.total - this.priceData.deliveryFee - this.priceData.convenienceFee - this.priceData.taxes
    }
  }

  findPrice(category, label) {
    const selectors = this.priceSelectors[category] || []
    let bestPrice = 0
    let foundElement = null
    const foundPrices = [] // Track all found prices for better selection

    // Try selector-based extraction
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector)

        for (const element of elements) {
          const extractedPrice = this.extractPriceFromElement(element)
          if (
            this.isValidPrice(extractedPrice) &&
            extractedPrice > 0 &&
            this.isReasonablePrice(extractedPrice, category)
          ) {
            foundPrices.push({
              price: extractedPrice,
              element,
              method: "selector",
              context: this.getPriceContext(element),
            })
          }
        }
      } catch (error) {
        console.warn("[TrueCost] Selector error:", selector, error)
      }
    }

    // Try text-based search if no prices found
    if (foundPrices.length === 0) {
      const textSearchTerms = this.getTextSearchTermsForCategory(category)
      for (const term of textSearchTerms) {
        const elements = this.findElementsByText(term)
        for (const element of elements) {
          const extractedPrice = this.extractPriceFromElement(element)
          if (
            this.isValidPrice(extractedPrice) &&
            extractedPrice > 0 &&
            this.isReasonablePrice(extractedPrice, category)
          ) {
            foundPrices.push({ price: extractedPrice, element, method: "text", context: this.getPriceContext(element) })
          }
        }
      }
    }

    if (foundPrices.length > 0) {
      const selectedPrice = this.selectBestPrice(foundPrices, category)

      bestPrice = selectedPrice.price
      foundElement = selectedPrice.element
    }

    if (foundElement && this.isValidPrice(bestPrice) && bestPrice > 0) {
      this.priceData.breakdown.push({
        label: label,
        amount: bestPrice,
        element: foundElement.outerHTML.substring(0, 200),
        isHidden: category !== "basePrice" && category !== "total",
      })
    }

    return bestPrice
  }

  getPriceContext(element) {
    const parent =
      element.closest('[class*="price"], [class*="amount"], [class*="cost"], [class*="fee"], [class*="total"]') ||
      element.parentElement
    const context = parent ? parent.textContent.toLowerCase() : element.textContent.toLowerCase()

    return {
      text: context,
      hasDeliveryKeywords: /delivery|shipping|courier/.test(context),
      hasConvenienceKeywords: /convenience|handling|processing|service|platform/.test(context),
      hasTaxKeywords: /tax|gst|vat/.test(context),
      hasTotalKeywords: /total|grand|final|amount/.test(context),
      hasBaseKeywords: /price|cost|mrp|item/.test(context),
    }
  }

  selectBestPrice(foundPrices, category) {
    if (foundPrices.length === 1) return foundPrices[0]

    // Filter by context relevance first
    let contextFiltered = foundPrices.filter((p) => this.isContextRelevant(p.context, category))
    if (contextFiltered.length === 0) contextFiltered = foundPrices

    if (category === "total") {
      // For total, select the highest reasonable price
      return contextFiltered.reduce((max, current) => (current.price > max.price ? current : max))
    } else if (category === "basePrice") {
      // For base price, select a reasonable price (not too high, not too low)
      const reasonable = contextFiltered.filter((p) => p.price > 10 && p.price < 50000)
      return reasonable.length > 0 ? reasonable[0] : contextFiltered[0]
    } else {
      // For fees, select the most contextually relevant price
      const contextRelevant = contextFiltered.filter((p) => this.isContextRelevant(p.context, category))
      return contextRelevant.length > 0 ? contextRelevant[0] : contextFiltered[0]
    }
  }

  isContextRelevant(context, category) {
    switch (category) {
      case "deliveryFee":
        return context.hasDeliveryKeywords
      case "convenienceFee":
        return context.hasConvenienceKeywords
      case "taxes":
        return context.hasTaxKeywords
      case "total":
        return context.hasTotalKeywords
      case "basePrice":
        return context.hasBaseKeywords
      default:
        return true
    }
  }

  isReasonablePrice(price, category) {
    // Basic sanity checks
    if (price < 0.01 || price > 100000) return false

    // Category-specific validation
    switch (category) {
      case "basePrice":
        return price >= 1 && price <= 50000 // Base price should be reasonable
      case "deliveryFee":
        return price >= 0 && price <= 500 // Delivery fees typically under ₹500
      case "convenienceFee":
        return price >= 0 && price <= 200 // Convenience fees typically under ₹200
      case "taxes":
        return price >= 0 && price <= 5000 // Taxes can be higher but reasonable
      case "total":
        return price >= 1 && price <= 100000 // Total can be higher
      default:
        return price >= 0 && price <= 1000
    }
  }

  extractPriceFromElement(element) {
    if (!element) return 0

    const text = element.textContent || element.innerText || element.value || ""

    // Try direct text parsing first
    let price = this.parsePrice(text)

    // If no price found, try looking in data attributes
    if (price === 0) {
      const dataPrice =
        element.getAttribute("data-price") || element.getAttribute("data-amount") || element.getAttribute("value")
      if (dataPrice) {
        price = this.parsePrice(dataPrice)
      }
    }

    // If still no price, try looking in child elements
    if (price === 0) {
      const priceElements = element.querySelectorAll('[class*="price"], [class*="amount"], [class*="cost"]')
      for (const priceEl of priceElements) {
        const childPrice = this.parsePrice(priceEl.textContent)
        if (childPrice > price) {
          price = childPrice
        }
      }
    }

    return this.isValidPrice(price) ? price : 0
  }

  parsePrice(text) {
    if (!text || typeof text !== "string") return 0

    // Remove currency symbols and clean the text
    let cleanText = text
      .replace(/[₹$€£¥]/g, "") // Remove currency symbols
      .replace(/[,\s]/g, "") // Remove commas and spaces
      .replace(/[^\d.-]/g, "") // Keep only digits, dots, and hyphens
      .trim()

    // Handle negative signs properly
    const isNegative = cleanText.startsWith("-")
    if (isNegative) {
      cleanText = cleanText.substring(1)
    }

    // Find the first valid price pattern
    const pricePattern = /(\d+(?:\.\d{1,2})?)/
    const matches = cleanText.match(pricePattern)

    if (matches && matches[1]) {
      const price = Number.parseFloat(matches[1])

      if (isNaN(price) || price < 0 || price > 100000 || price.toString().includes("e")) {
        return 0 // Reject unrealistic prices and scientific notation
      }

      return isNegative ? 0 : price // Don't accept negative prices as valid
    }

    return 0
  }

  calculateHiddenCharges() {
    // Validate all price components before calculation
    const validatedPrices = {
      basePrice: this.isValidPrice(this.priceData.basePrice) ? this.priceData.basePrice : 0,
      deliveryFee: this.isValidPrice(this.priceData.deliveryFee) ? this.priceData.deliveryFee : 0,
      convenienceFee: this.isValidPrice(this.priceData.convenienceFee) ? this.priceData.convenienceFee : 0,
      taxes: this.isValidPrice(this.priceData.taxes) ? this.priceData.taxes : 0,
      otherFees: this.isValidPrice(this.priceData.otherFees) ? this.priceData.otherFees : 0,
      total: this.isValidPrice(this.priceData.total) ? this.priceData.total : 0,
    }

    if (validatedPrices.basePrice > 0) {
      // Delivery fee shouldn't be more than 50% of base price typically
      if (validatedPrices.deliveryFee > validatedPrices.basePrice * 0.5) {
        console.warn("[TrueCost] Delivery fee seems too high, resetting to 0")
        validatedPrices.deliveryFee = 0
      }

      // Convenience fee shouldn't be more than 20% of base price typically
      if (validatedPrices.convenienceFee > validatedPrices.basePrice * 0.2) {
        console.warn("[TrueCost] Convenience fee seems too high, resetting to 0")
        validatedPrices.convenienceFee = 0
      }
    }

    // Update priceData with validated values
    Object.assign(this.priceData, validatedPrices)

    this.priceData.hiddenCharges =
      this.priceData.deliveryFee + this.priceData.convenienceFee + this.priceData.taxes + this.priceData.otherFees

    if (this.priceData.basePrice > 0 && this.isValidPrice(this.priceData.hiddenCharges)) {
      this.priceData.hiddenPercentage = Math.round((this.priceData.hiddenCharges / this.priceData.basePrice) * 100)

      // Cap percentage at reasonable limit
      if (this.priceData.hiddenPercentage > 100) {
        console.warn("[TrueCost] Hidden charges percentage seems too high, recalculating")
        this.priceData.hiddenPercentage = 0
        this.priceData.hiddenCharges = 0
      }
    }

    if (this.priceData.total > 0 && this.priceData.basePrice > 0) {
      const calculatedTotal = this.priceData.basePrice + this.priceData.hiddenCharges
      const difference = this.priceData.total - calculatedTotal

      // Only add other fees if difference is reasonable (between 1 and 10% of base price)
      const maxOtherFees = Math.max(100, this.priceData.basePrice * 0.1)
      if (difference > 1 && difference < maxOtherFees && this.isValidPrice(difference)) {
        this.priceData.otherFees = difference
        this.priceData.hiddenCharges += difference
        if (this.priceData.basePrice > 0) {
          this.priceData.hiddenPercentage = Math.round((this.priceData.hiddenCharges / this.priceData.basePrice) * 100)
        }
      }
    }
  }

  isValidPrice(price) {
    return (
      typeof price === "number" &&
      !isNaN(price) &&
      isFinite(price) &&
      price >= 0 &&
      price <= 100000 && // Reduced max reasonable price
      price.toString().indexOf("e") === -1 // No scientific notation
    )
  }

  sendResults() {
    // Validate data before sending
    const hasValidData =
      this.isValidPrice(this.priceData.basePrice) ||
      this.isValidPrice(this.priceData.total) ||
      this.priceData.breakdown.length > 0

    if (!hasValidData) {
      console.log("[TrueCost] No valid price data found, skipping popup")
      return
    }

    if (typeof window.chrome !== "undefined" && window.chrome.runtime) {
      window.chrome.runtime.sendMessage(
        {
          type: "HIDDEN_FEES_DETECTED",
          data: this.priceData,
        },
        (response) => {
          if (window.chrome.runtime.lastError) {
            console.error("[TrueCost] Message error:", window.chrome.runtime.lastError)
          }
        },
      )
    }

    sessionStorage.setItem("truecost_data", JSON.stringify(this.priceData))

    if (!this.hasShownPopup && hasValidData && (this.priceData.hiddenCharges > 0 || this.priceData.total > 10)) {
      this.showComprehensivePopup()
      this.hasShownPopup = true
    }

    this.highlightFeeElements()
  }

  showComprehensivePopup() {
    const existingPopup = document.getElementById("truecost-comprehensive-popup")
    if (existingPopup) {
      existingPopup.remove()
    }

    const popup = document.createElement("div")
    popup.id = "truecost-comprehensive-popup"
    popup.className = "truecost-comprehensive-popup"

    const hasHiddenFees = this.priceData.hiddenCharges > 0
    const statusClass = hasHiddenFees ? "warning" : "success"
    const statusIcon = hasHiddenFees ? "⚠️" : "✅"
    const statusTitle = hasHiddenFees ? "Hidden Fees Detected!" : "No Hidden Fees Found"

    popup.innerHTML = `
      <div class="truecost-popup-overlay">
        <div class="truecost-popup-content ${statusClass}">
          <div class="truecost-popup-header">
            <div class="truecost-popup-icon">${statusIcon}</div>
            <h3 class="truecost-popup-title">${statusTitle}</h3>
            <button class="truecost-popup-close" id="truecost-close-btn">×</button>
          </div>
          
          <div class="truecost-popup-body">
            ${this.generatePopupContent()}
          </div>
          
          <div class="truecost-popup-footer">
            <button class="truecost-popup-btn primary" id="truecost-understand-btn">
              I Understand
            </button>
            <button class="truecost-popup-btn secondary" id="truecost-details-btn">
              View Details
            </button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(popup)

    const closeBtn = popup.querySelector("#truecost-close-btn")
    const understandBtn = popup.querySelector("#truecost-understand-btn")
    const detailsBtn = popup.querySelector("#truecost-details-btn")
    const overlay = popup.querySelector(".truecost-popup-overlay")

    const closePopup = () => {
      popup.classList.add("closing")
      setTimeout(() => popup.remove(), 300)
    }

    closeBtn.addEventListener("click", closePopup)
    understandBtn.addEventListener("click", closePopup)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePopup()
    })

    detailsBtn.addEventListener("click", () => {
      if (typeof window.chrome !== "undefined" && window.chrome.runtime) {
        window.chrome.runtime.sendMessage({ type: "OPEN_POPUP" })
      }
      closePopup()
    })

    setTimeout(() => popup.classList.add("show"), 100)
  }

  generatePopupContent() {
    if (this.priceData.hiddenCharges > 0) {
      const paymentSuggestion = this.generatePaymentMethodSuggestion()

      return `
        <div class="truecost-summary">
          <div class="truecost-amount-row">
            <span>Base Price:</span>
            <span class="amount">${this.priceData.currency}${this.priceData.basePrice}</span>
          </div>
          ${
            this.priceData.deliveryFee > 0
              ? `
            <div class="truecost-amount-row fee">
              <span>Delivery Fee:</span>
              <span class="amount">+${this.priceData.currency}${this.priceData.deliveryFee}</span>
            </div>
          `
              : ""
          }
          ${
            this.priceData.convenienceFee > 0
              ? `
            <div class="truecost-amount-row fee">
              <span>Convenience Fee:</span>
              <span class="amount">+${this.priceData.currency}${this.priceData.convenienceFee}</span>
            </div>
          `
              : ""
          }
          ${
            this.priceData.taxes > 0
              ? `
            <div class="truecost-amount-row fee">
              <span>Taxes:</span>
              <span class="amount">+${this.priceData.currency}${this.priceData.taxes}</span>
            </div>
          `
              : ""
          }
          ${
            this.priceData.otherFees > 0
              ? `
            <div class="truecost-amount-row fee">
              <span>Other Fees:</span>
              <span class="amount">+${this.priceData.currency}${this.priceData.otherFees}</span>
            </div>
          `
              : ""
          }
          <div class="truecost-amount-row total">
            <span><strong>Total Hidden Charges:</strong></span>
            <span class="amount"><strong>${this.priceData.currency}${this.priceData.hiddenCharges} (${this.priceData.hiddenPercentage}%)</strong></span>
          </div>
        </div>
        <p class="truecost-message">You're paying <strong>${this.priceData.hiddenPercentage}%</strong> more than the base price due to additional charges.</p>
        ${paymentSuggestion}
      `
    } else {
      return `
        <div class="truecost-summary">
          <div class="truecost-amount-row">
            <span>Total Amount:</span>
            <span class="amount">${this.priceData.currency}${this.priceData.total || this.priceData.basePrice}</span>
          </div>
        </div>
        <p class="truecost-message">Great! This checkout appears to be transparent with no hidden charges detected.</p>
      `
    }
  }

  generatePaymentMethodSuggestion() {
    if (this.paymentMethods.length <= 1) return ""

    const currentMethod = this.paymentMethods.find((method) => method.isSelected)
    const alternatives = this.paymentMethods.filter((method) => !method.isSelected)

    if (!currentMethod || alternatives.length === 0) return ""

    const currentFee = Math.max(...currentMethod.fees)
    const bestAlternative = alternatives.reduce((best, method) => {
      const methodFee = Math.max(...method.fees)
      return methodFee < (best ? Math.max(...best.fees) : Number.POSITIVE_INFINITY) ? method : best
    }, null)

    if (bestAlternative) {
      const bestFee = Math.max(...bestAlternative.fees)
      const savings = currentFee - bestFee

      if (savings > 0) {
        return `
          <div class="truecost-payment-suggestion">
            <div class="suggestion-header">💡 Payment Method Suggestion</div>
            <p class="suggestion-text">
              Switch to <strong>${bestAlternative.name}</strong> and save <strong>${this.priceData.currency}${savings}</strong>!
            </p>
            <div class="suggestion-comparison">
              <div class="current-method">Current: ${currentMethod.name} (+${this.priceData.currency}${currentFee})</div>
              <div class="better-method">Better: ${bestAlternative.name} (+${this.priceData.currency}${bestFee})</div>
            </div>
          </div>
        `
      }
    }

    return ""
  }

  sendError(errorMessage) {
    const errorData = {
      ...this.priceData,
      error: errorMessage,
      hasError: true,
    }

    if (typeof window.chrome !== "undefined" && window.chrome.runtime) {
      window.chrome.runtime.sendMessage({
        type: "ANALYSIS_ERROR",
        data: errorData,
      })
    }

    sessionStorage.setItem("truecost_data", JSON.stringify(errorData))
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReanalyze = false
      let significantChange = false

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent || ""
              if (
                (text.includes("total") && this.containsPrice(text)) ||
                (text.includes("checkout") && this.containsPrice(text)) ||
                node.querySelector('[class*="total"], [class*="price"], [class*="amount"]')
              ) {
                significantChange = true
                shouldReanalyze = true
              }
            }
          })
        }
      })

      if (shouldReanalyze && significantChange && this.analysisCount < 3) {
        console.log("[TrueCost] Significant page change detected, re-analyzing...")
        clearTimeout(this.reanalysisTimeout)
        this.reanalysisTimeout = setTimeout(() => {
          this.isAnalyzing = false
          this.hasShownPopup = false
          this.startAnalysis()
        }, 2000)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  highlightFeeElements() {
    document.querySelectorAll(".truecost-highlighted, .truecost-base-price").forEach((el) => {
      el.classList.remove("truecost-highlighted", "truecost-base-price")
    })

    this.priceData.breakdown.forEach((item) => {
      try {
        const elements = this.findElementsWithPrice(item.amount, item.label)
        elements.forEach((element) => {
          if (item.isHidden) {
            this.addSideMarker(element, "Hidden Fee", "warning")
          } else if (item.label === "Base Price") {
            this.addSideMarker(element, "Base Price", "success")
          }
        })
      } catch (error) {
        console.warn("[TrueCost] Highlight error:", error)
      }
    })
  }

  addSideMarker(element, label, type) {
    const existingMarker = element.querySelector(".truecost-side-marker")
    if (existingMarker) {
      existingMarker.remove()
    }

    const marker = document.createElement("div")
    marker.className = `truecost-side-marker truecost-marker-${type}`
    marker.textContent = label

    element.style.position = "relative"
    element.appendChild(marker)
  }

  findElementsWithPrice(price, label) {
    const elements = []
    const priceText = price.toString()

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false)

    let node
    while ((node = walker.nextNode())) {
      const text = node.textContent
      if (text.includes(priceText) && this.containsPrice(text)) {
        const element = node.parentElement
        if (element && !elements.includes(element)) {
          elements.push(element)
        }
      }
    }

    return elements
  }

  containsPrice(text) {
    if (!text || typeof text !== "string") return false

    // Look for currency symbols followed by numbers or numbers followed by currency
    const pricePatterns = [
      /[₹$€£¥]\s*\d+(?:\.\d{1,2})?/,
      /\d+(?:\.\d{1,2})?\s*[₹$€£¥]/,
      /\d+\.\d{2}(?!\d)/, // Decimal prices like 123.45
      /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/, // Comma-separated prices
    ]

    return pricePatterns.some((pattern) => pattern.test(text))
  }

  getTextSearchTermsForCategory(category) {
    const searchTerms = {
      basePrice: ["Item Price", "Product Price", "Base Price", "MRP", "Price:", "Cost:", "Amount:", "Subtotal"],
      deliveryFee: [
        "Delivery Fee",
        "Shipping Fee",
        "Delivery Charge",
        "Shipping Charge",
        "Courier Fee",
        "Delivery:",
        "Shipping:",
      ],
      convenienceFee: [
        "Convenience Fee",
        "Handling Fee",
        "Processing Fee",
        "Service Fee",
        "Platform Fee",
        "Convenience:",
        "Handling:",
        "Processing:",
      ],
      taxes: ["Tax", "GST", "VAT", "CGST", "SGST", "IGST", "Taxes:", "Tax Amount"],
      total: ["Total", "Grand Total", "Final Amount", "Order Total", "Amount Payable", "Total Amount", "Total:"],
    }

    return searchTerms[category] || []
  }

  findElementsByText(searchTerm) {
    const elements = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false)

    let node
    while ((node = walker.nextNode())) {
      const text = node.textContent
      if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
        const element = node.parentElement
        if (element && !elements.includes(element)) {
          elements.push(element)
        }
      }
    }

    return elements
  }
}

class NotificationManager {
  constructor() {
    this.notifications = []
  }

  showNotification(options) {
    // Reserved for minor notifications if needed
  }

  clearAll() {
    this.notifications.forEach((notification) => {
      if (notification.parentElement) {
        notification.remove()
      }
    })
    this.notifications = []
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new TrueCostDetector()
  })
} else {
  new TrueCostDetector()
}
