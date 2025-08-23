// TrueCost Popup Interface
const SavingsEngine = class {
  // Declare the SavingsEngine variable
  async generateSuggestions(data, userHistory) {
    // Placeholder for suggestion generation logic
    return []
  }
}

class TrueCostPopup {
  constructor() {
    this.elements = {}
    this.currentData = null
    this.savingsEngine = new SavingsEngine()
    this.init()
  }

  init() {
    this.cacheElements()
    this.bindEvents()
    this.loadData()
  }

  cacheElements() {
    // Status elements
    this.elements.statusIndicator = document.getElementById("statusIndicator")
    this.elements.statusDot = this.elements.statusIndicator.querySelector(".status-dot")
    this.elements.statusText = this.elements.statusIndicator.querySelector(".status-text")

    // Main content sections
    this.elements.mainContent = document.getElementById("mainContent")
    this.elements.loadingState = document.getElementById("loadingState")
    this.elements.feeBreakdown = document.getElementById("feeBreakdown")
    this.elements.noFees = document.getElementById("noFees")
    this.elements.errorState = document.getElementById("errorState")

    // Fee breakdown elements
    this.elements.siteInfo = document.getElementById("siteInfo")
    this.elements.priceDetails = document.getElementById("priceDetails")
    this.elements.totalAmount = document.getElementById("totalAmount")
    this.elements.hiddenCharges = document.getElementById("hiddenCharges")

    // Chart elements
    this.elements.basePriceBar = document.getElementById("basePriceBar")
    this.elements.hiddenFeesBar = document.getElementById("hiddenFeesBar")

    // Suggestions and history
    this.elements.suggestions = document.getElementById("suggestions")
    this.elements.suggestionList = document.getElementById("suggestionList")
    this.elements.historyList = document.getElementById("historyList")
    this.elements.clearHistory = document.getElementById("clearHistory")
  }

  bindEvents() {
    // Clear history button
    this.elements.clearHistory.addEventListener("click", () => {
      this.clearTransactionHistory()
    })

    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("export-history")) {
        this.exportHistory(e.target.dataset.format)
      }

      if (e.target.classList.contains("delete-transaction")) {
        this.deleteTransaction(e.target.dataset.transactionId)
      }

      if (e.target.classList.contains("show-analytics")) {
        this.showAnalytics()
      }

      if (e.target.classList.contains("suggestion-action")) {
        this.handleSuggestionAction(e.target)
      }
    })

    // Listen for messages from content script
    window.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "HIDDEN_FEES_DETECTED" || message.type === "ANALYSIS_ERROR") {
        this.handleDataUpdate(message.data)
      }
    })
  }

  async loadData() {
    try {
      // First try to get data from session storage (from content script)
      const [tab] = await window.chrome.tabs.query({ active: true, currentWindow: true })

      if (tab) {
        // Execute script to get session storage data
        const results = await window.chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const data = sessionStorage.getItem("truecost_data")
            return data ? JSON.parse(data) : null
          },
        })

        if (results && results[0] && results[0].result) {
          this.handleDataUpdate(results[0].result)
          return
        }
      }

      // If no data found, check if we're on a checkout page
      if (this.isCheckoutPage(tab?.url)) {
        this.showLoadingState()
        // Wait a bit for content script to analyze
        setTimeout(() => {
          this.loadData()
        }, 3000)
      } else {
        this.showErrorState("This page doesn't appear to be a checkout page.")
      }
    } catch (error) {
      console.error("[TrueCost Popup] Load error:", error)
      this.showErrorState("Unable to analyze this page.")
    }

    // Load transaction history
    this.loadTransactionHistory()
  }

  isCheckoutPage(url) {
    if (!url) return false
    const checkoutKeywords = ["checkout", "cart", "payment", "billing", "pay", "order"]
    return checkoutKeywords.some((keyword) => url.toLowerCase().includes(keyword))
  }

  handleDataUpdate(data) {
    this.currentData = data

    if (data.hasError) {
      this.showErrorState(data.error)
    } else if (data.hiddenCharges > 0) {
      this.showFeeBreakdown(data)
      this.generateSuggestions(data)
    } else if (data.total > 0) {
      this.showNoFeesState()
    } else {
      this.showErrorState("No pricing information detected on this page.")
    }

    // Save to transaction history if valid data
    if (data.total > 0 && !data.hasError) {
      this.saveTransaction(data)
    }
  }

  showLoadingState() {
    this.hideAllStates()
    this.elements.loadingState.classList.remove("hidden")
    this.updateStatus("scanning", "Scanning...")
  }

  showFeeBreakdown(data) {
    this.hideAllStates()
    this.elements.feeBreakdown.classList.remove("hidden")
    this.updateStatus("error", `${data.hiddenPercentage}% Hidden Fees`)

    // Update site info
    this.elements.siteInfo.textContent = `Analysis for ${data.site}`

    // Build price breakdown
    this.buildPriceBreakdown(data)

    // Update totals
    this.elements.totalAmount.textContent = `${data.currency}${data.total}`
    this.elements.hiddenCharges.querySelector(".amount-highlight").textContent =
      `${data.currency}${data.hiddenCharges} (${data.hiddenPercentage}%)`

    // Update chart
    this.updateChart(data)
  }

  showNoFeesState() {
    this.hideAllStates()
    this.elements.noFees.classList.remove("hidden")
    this.updateStatus("success", "No Hidden Fees")
  }

  showErrorState(message = "Unable to analyze this page.") {
    this.hideAllStates()
    this.elements.errorState.classList.remove("hidden")
    this.elements.errorState.querySelector("p").textContent = message
    this.updateStatus("error", "Analysis Failed")
  }

  hideAllStates() {
    this.elements.loadingState.classList.add("hidden")
    this.elements.feeBreakdown.classList.add("hidden")
    this.elements.noFees.classList.add("hidden")
    this.elements.errorState.classList.add("hidden")
    this.elements.suggestions.classList.add("hidden")
  }

  updateStatus(type, text) {
    this.elements.statusText.textContent = text
    this.elements.statusDot.className = `status-dot ${type}`
  }

  buildPriceBreakdown(data) {
    this.elements.priceDetails.innerHTML = ""

    const priceItems = [
      { label: "Base Price", amount: data.basePrice, isHidden: false },
      { label: "Delivery Fee", amount: data.deliveryFee, isHidden: true },
      { label: "Convenience Fee", amount: data.convenienceFee, isHidden: true },
      { label: "Taxes", amount: data.taxes, isHidden: true },
      { label: "Other Fees", amount: data.otherFees, isHidden: true },
    ]

    priceItems.forEach((item) => {
      if (item.amount > 0) {
        const priceItem = document.createElement("div")
        priceItem.className = "price-item"

        priceItem.innerHTML = `
          <span class="price-label">${item.label}</span>
          <span class="price-amount ${item.isHidden ? "hidden-fee" : ""}">${data.currency}${item.amount}</span>
        `

        this.elements.priceDetails.appendChild(priceItem)
      }
    })
  }

  updateChart(data) {
    const total = data.basePrice + data.hiddenCharges
    const basePercentage = (data.basePrice / total) * 100
    const hiddenPercentage = (data.hiddenCharges / total) * 100

    this.elements.basePriceBar.style.width = `${basePercentage}%`
    this.elements.hiddenFeesBar.style.width = `${hiddenPercentage}%`
  }

  async generateSuggestions(data) {
    try {
      // Get user history for better suggestions
      const historyResponse = await window.chrome.runtime.sendMessage({
        type: "GET_TRANSACTION_HISTORY",
      })

      const userHistory = historyResponse.success ? historyResponse.data : []

      // Generate comprehensive suggestions
      const suggestions = await this.savingsEngine.generateSuggestions(data, userHistory)

      if (suggestions.length > 0) {
        this.showAdvancedSuggestions(suggestions)
      }
    } catch (error) {
      console.error("[TrueCost] Suggestions error:", error)
      // Fallback to basic suggestions
      this.showBasicSuggestions(data)
    }
  }

  showAdvancedSuggestions(suggestions) {
    this.elements.suggestions.classList.remove("hidden")
    this.elements.suggestionList.innerHTML = ""

    // Group suggestions by category
    const groupedSuggestions = this.groupSuggestionsByCategory(suggestions)

    Object.entries(groupedSuggestions).forEach(([category, categorySuggestions]) => {
      // Create category header
      const categoryHeader = document.createElement("div")
      categoryHeader.className = "suggestion-category-header"
      categoryHeader.innerHTML = `
        <h4>${category}</h4>
        <span class="category-count">${categorySuggestions.length}</span>
      `
      this.elements.suggestionList.appendChild(categoryHeader)

      // Add suggestions in this category
      categorySuggestions.forEach((suggestion) => {
        const suggestionItem = this.createAdvancedSuggestionItem(suggestion)
        this.elements.suggestionList.appendChild(suggestionItem)
      })
    })

    // Add total potential savings
    const totalSavings = suggestions.reduce((sum, s) => sum + (s.savings || 0), 0)
    if (totalSavings > 0) {
      const savingsSummary = document.createElement("div")
      savingsSummary.className = "savings-summary"
      savingsSummary.innerHTML = `
        <div class="total-savings">
          <span class="savings-label">Total Potential Savings:</span>
          <span class="savings-amount">${this.currentData.currency}${totalSavings}</span>
        </div>
      `
      this.elements.suggestionList.appendChild(savingsSummary)
    }
  }

  createAdvancedSuggestionItem(suggestion) {
    const suggestionItem = document.createElement("div")
    suggestionItem.className = `suggestion-item priority-${suggestion.priority}`

    const savingsText =
      suggestion.savings > 0
        ? `<span class="suggestion-savings">Save ${this.currentData.currency}${suggestion.savings}</span>`
        : ""

    const actionButton = suggestion.actionable
      ? `<button class="suggestion-action" data-suggestion-type="${suggestion.type}" data-link="${suggestion.link || ""}" data-affiliate="${suggestion.affiliate || false}">
           ${suggestion.ctaText || "Apply"}
         </button>`
      : ""

    const priorityIndicator = suggestion.priority === "high" ? '<span class="priority-badge">High Impact</span>' : ""

    suggestionItem.innerHTML = `
      <div class="suggestion-content">
        <div class="suggestion-header">
          <span class="suggestion-icon">${suggestion.icon}</span>
          <div class="suggestion-title-area">
            <h5 class="suggestion-title">${suggestion.title}</h5>
            ${priorityIndicator}
          </div>
          ${savingsText}
        </div>
        <p class="suggestion-description">${suggestion.description}</p>
        ${suggestion.steps ? this.createStepsList(suggestion.steps) : ""}
        <div class="suggestion-actions">
          ${actionButton}
          ${suggestion.isPartnerOffer ? '<span class="partner-badge">Partner Offer</span>' : ""}
          ${suggestion.isPremiumFeature ? '<span class="premium-badge">Premium</span>' : ""}
        </div>
      </div>
    `

    return suggestionItem
  }

  createStepsList(steps) {
    return `
      <div class="suggestion-steps">
        <span class="steps-label">How to:</span>
        <ol class="steps-list">
          ${steps.map((step) => `<li>${step}</li>`).join("")}
        </ol>
      </div>
    `
  }

  groupSuggestionsByCategory(suggestions) {
    return suggestions.reduce((groups, suggestion) => {
      const category = suggestion.category || "Other"
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(suggestion)
      return groups
    }, {})
  }

  showBasicSuggestions(data) {
    // Fallback to original simple suggestions
    const suggestions = []

    // Payment method suggestions
    if (data.convenienceFee > 0) {
      suggestions.push({
        type: "payment",
        text: `Try UPI/Direct Bank Transfer to save ${data.currency}${data.convenienceFee} in convenience fees`,
        savings: data.convenienceFee,
      })
    }

    // Delivery suggestions
    if (data.deliveryFee > 0) {
      suggestions.push({
        type: "delivery",
        text: `Consider pickup or free delivery threshold to save ${data.currency}${data.deliveryFee}`,
        savings: data.deliveryFee,
      })
    }

    // General suggestions
    if (data.hiddenPercentage > 15) {
      suggestions.push({
        type: "alternative",
        text: "High markup detected. Consider checking competitor prices",
        savings: 0,
      })
    }

    if (suggestions.length > 0) {
      this.showSuggestions(suggestions)
    }
  }

  showSuggestions(suggestions) {
    this.elements.suggestions.classList.remove("hidden")
    this.elements.suggestionList.innerHTML = ""

    suggestions.forEach((suggestion) => {
      const suggestionItem = document.createElement("div")
      suggestionItem.className = "suggestion-item"
      suggestionItem.textContent = suggestion.text
      this.elements.suggestionList.appendChild(suggestionItem)
    })
  }

  async saveTransaction(data) {
    const transaction = {
      site: data.site,
      basePrice: data.basePrice,
      hiddenCharges: data.hiddenCharges,
      hiddenPercentage: data.hiddenPercentage,
      total: data.total,
      currency: data.currency,
      url: window.location.href,
      timestamp: Date.now(),
      categories: data.categories || [],
    }

    try {
      await window.chrome.runtime.sendMessage({
        type: "SAVE_TRANSACTION",
        data: transaction,
      })
    } catch (error) {
      console.error("[TrueCost Popup] Save transaction error:", error)
    }
  }

  async loadTransactionHistory() {
    try {
      const response = await window.chrome.runtime.sendMessage({
        type: "GET_TRANSACTION_HISTORY",
      })

      if (response.success && response.data.length > 0) {
        this.displayTransactionHistory(response.data)
      }
    } catch (error) {
      console.error("[TrueCost Popup] Load history error:", error)
    }
  }

  displayTransactionHistory(history) {
    this.elements.historyList.innerHTML = ""

    if (history.length === 0) {
      this.elements.historyList.innerHTML = '<p class="no-history">No recent transactions</p>'
      return
    }

    const historyHeader = document.createElement("div")
    historyHeader.className = "history-header"
    historyHeader.innerHTML = `
      <div class="history-stats">
        <span class="stat-item">Total: ${history.length}</span>
        <span class="stat-item">Avg Hidden: ${this.calculateAverageHidden(history)}%</span>
      </div>
      <div class="history-actions">
        <button class="export-history" data-format="csv" title="Export as CSV">📊</button>
        <button class="export-history" data-format="json" title="Export as JSON">📄</button>
        <button class="show-analytics" title="Show Analytics">📈</button>
      </div>
    `
    this.elements.historyList.appendChild(historyHeader)

    history.forEach((transaction) => {
      const historyItem = document.createElement("div")
      historyItem.className = "history-item"

      const date = new Date(transaction.timestamp).toLocaleDateString()
      const time = new Date(transaction.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const categories = (transaction.categories || []).join(", ")

      historyItem.innerHTML = `
        <div class="history-main">
          <div class="history-site">${transaction.site}</div>
          <div class="history-meta">
            <span class="history-date">${date} ${time}</span>
            ${categories ? `<span class="history-categories">${categories}</span>` : ""}
          </div>
        </div>
        <div class="history-amounts">
          <div class="history-total">${transaction.currency}${transaction.total}</div>
          <div class="history-hidden">+${transaction.currency}${transaction.hiddenCharges} (${transaction.hiddenPercentage}%)</div>
        </div>
        <button class="delete-transaction" data-transaction-id="${transaction.id}" title="Delete">×</button>
      `

      this.elements.historyList.appendChild(historyItem)
    })
  }

  // Utility method to calculate average hidden fees
  calculateAverageHidden(history) {
    if (history.length === 0) return 0
    const total = history.reduce((sum, transaction) => sum + (transaction.hiddenPercentage || 0), 0)
    return Math.round(total / history.length)
  }

  async exportHistory(format) {
    try {
      const response = await window.chrome.runtime.sendMessage({
        type: "EXPORT_HISTORY",
        format: format,
      })

      if (response.success) {
        this.showTemporaryMessage(`History exported as ${response.filename}`, "success")
      } else {
        this.showTemporaryMessage("Export failed: " + response.error, "error")
      }
    } catch (error) {
      console.error("[TrueCost Popup] Export error:", error)
      this.showTemporaryMessage("Export failed", "error")
    }
  }

  async deleteTransaction(transactionId) {
    try {
      const response = await window.chrome.runtime.sendMessage({
        type: "DELETE_TRANSACTION",
        transactionId: transactionId,
      })

      if (response.success) {
        this.loadTransactionHistory() // Refresh the list
        this.showTemporaryMessage("Transaction deleted", "success")
      } else {
        this.showTemporaryMessage("Delete failed: " + response.error, "error")
      }
    } catch (error) {
      console.error("[TrueCost Popup] Delete error:", error)
      this.showTemporaryMessage("Delete failed", "error")
    }
  }

  async showAnalytics() {
    try {
      const response = await window.chrome.runtime.sendMessage({
        type: "GET_ANALYTICS",
      })

      if (response.success) {
        this.displayAnalytics(response.data)
      }
    } catch (error) {
      console.error("[TrueCost Popup] Analytics error:", error)
    }
  }

  displayAnalytics(analytics) {
    const analyticsModal = document.createElement("div")
    analyticsModal.className = "analytics-modal"
    analyticsModal.innerHTML = `
      <div class="analytics-content">
        <div class="analytics-header">
          <h3>Your TrueCost Analytics</h3>
          <button class="close-analytics">×</button>
        </div>
        <div class="analytics-stats">
          <div class="stat-card">
            <div class="stat-value">${analytics.totalScans || 0}</div>
            <div class="stat-label">Total Scans</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">₹${analytics.totalHiddenFees || 0}</div>
            <div class="stat-label">Hidden Fees Found</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${analytics.averageHiddenPercentage || 0}%</div>
            <div class="stat-label">Avg Hidden %</div>
          </div>
        </div>
        <div class="top-sites">
          <h4>Top Offending Sites</h4>
          <div class="sites-list">
            ${this.renderTopSites(analytics.topOffendingSites || {})}
          </div>
        </div>
      </div>
    `

    document.body.appendChild(analyticsModal)

    // Close modal handler
    analyticsModal.querySelector(".close-analytics").addEventListener("click", () => {
      analyticsModal.remove()
    })

    // Close on outside click
    analyticsModal.addEventListener("click", (e) => {
      if (e.target === analyticsModal) {
        analyticsModal.remove()
      }
    })
  }

  renderTopSites(topSites) {
    const sites = Object.entries(topSites)
      .sort(([, a], [, b]) => b.totalFees - a.totalFees)
      .slice(0, 5)

    if (sites.length === 0) {
      return '<p class="no-data">No data available</p>'
    }

    return sites
      .map(
        ([site, data]) => `
      <div class="site-item">
        <div class="site-name">${site}</div>
        <div class="site-stats">
          <span>₹${data.totalFees} (${data.averagePercentage}%)</span>
          <span class="scan-count">${data.count} scans</span>
        </div>
      </div>
    `,
      )
      .join("")
  }

  showTemporaryMessage(message, type = "info") {
    const messageEl = document.createElement("div")
    messageEl.className = `temp-message ${type}`
    messageEl.textContent = message

    document.body.appendChild(messageEl)

    setTimeout(() => {
      messageEl.remove()
    }, 3000)
  }

  async clearTransactionHistory() {
    try {
      await window.chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" })
      this.elements.historyList.innerHTML = '<p class="no-history">No recent transactions</p>'
      this.showTemporaryMessage("History cleared", "success")
    } catch (error) {
      console.error("[TrueCost Popup] Clear history error:", error)
      this.showTemporaryMessage("Clear failed", "error")
    }
  }

  handleSuggestionAction(button) {
    const suggestionType = button.dataset.suggestionType
    const link = button.dataset.link
    const isAffiliate = button.dataset.affiliate === "true"

    switch (suggestionType) {
      case "alternative":
        if (link) {
          // Track affiliate click for monetization
          if (isAffiliate) {
            this.trackAffiliateClick(link)
          }
          window.chrome.tabs.create({ url: link })
        }
        break

      case "payment":
        this.showPaymentMethodGuide()
        break

      case "delivery":
        this.showDeliveryOptimizationTips()
        break

      case "premium":
        this.showPremiumFeatures()
        break

      case "affiliate":
        this.handlePartnerOffer(button)
        break

      default:
        this.showTemporaryMessage("Suggestion noted!", "info")
    }
  }

  trackAffiliateClick(link) {
    // Track for monetization analytics
    window.chrome.runtime.sendMessage({
      type: "TRACK_AFFILIATE_CLICK",
      data: { link, timestamp: Date.now() },
    })
  }

  showPaymentMethodGuide() {
    const modal = this.createModal(
      "Payment Method Guide",
      `
      <div class="guide-content">
        <h4>How to Use UPI Payment:</h4>
        <ol>
          <li>Look for "UPI" or "Pay by UPI" option at checkout</li>
          <li>Open your UPI app (Google Pay, PhonePe, Paytm)</li>
          <li>Scan the QR code or enter the UPI ID</li>
          <li>Enter your UPI PIN to complete payment</li>
        </ol>
        <div class="guide-tip">
          <strong>Tip:</strong> UPI payments are usually instant and have zero convenience fees!
        </div>
      </div>
    `,
    )
    document.body.appendChild(modal)
  }

  showDeliveryOptimizationTips() {
    const modal = this.createModal(
      "Delivery Optimization Tips",
      `
      <div class="guide-content">
        <h4>Ways to Save on Delivery:</h4>
        <ul>
          <li><strong>Free Delivery Threshold:</strong> Add items to reach minimum order value</li>
          <li><strong>Store Pickup:</strong> Collect from nearby store if available</li>
          <li><strong>Standard Delivery:</strong> Choose slower delivery for lower fees</li>
          <li><strong>Bulk Orders:</strong> Combine multiple purchases</li>
        </ul>
      </div>
    `,
    )
    document.body.appendChild(modal)
  }

  showPremiumFeatures() {
    const modal = this.createModal(
      "TrueCost Premium",
      `
      <div class="premium-content">
        <h4>Unlock Advanced Features:</h4>
        <ul class="premium-features">
          <li>✅ Real-time price alerts across all apps</li>
          <li>✅ Exclusive partner deals and discounts</li>
          <li>✅ Advanced analytics and spending insights</li>
          <li>✅ Automatic coupon code application</li>
          <li>✅ Price history tracking</li>
        </ul>
        <div class="premium-cta">
          <button class="premium-button">Coming Soon - Join Waitlist</button>
        </div>
      </div>
    `,
    )
    document.body.appendChild(modal)
  }

  handlePartnerOffer(button) {
    // Monetization hook - redirect to partner site with affiliate tracking
    const partnerUrl = "https://partner-site.com?ref=truecost&offer=special"
    this.trackAffiliateClick(partnerUrl)
    window.chrome.tabs.create({ url: partnerUrl })
    this.showTemporaryMessage("Redirecting to partner offer...", "info")
  }

  createModal(title, content) {
    const modal = document.createElement("div")
    modal.className = "suggestion-modal"
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `

    // Close modal handlers
    modal.querySelector(".modal-close").addEventListener("click", () => modal.remove())
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove()
    })

    return modal
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new TrueCostPopup()
})
