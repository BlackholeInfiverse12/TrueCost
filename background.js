// TrueCost Background Service Worker

const chrome = window.chrome // Declare the chrome variable

class TrueCostBackground {
  constructor() {
    this.initializeExtension()
  }

  initializeExtension() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        console.log("TrueCost extension installed")
        this.setBadgeText("")
        this.initializeStorage()
      }
    })

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true // Keep message channel open for async response
    })

    // Listen for tab updates to reset badge
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete") {
        this.resetBadgeForTab(tabId)
      }
    })
  }

  async initializeStorage() {
    try {
      const result = await chrome.storage.local.get(["transactionHistory", "analytics", "settings"])

      if (!result.transactionHistory) {
        await chrome.storage.local.set({ transactionHistory: [] })
      }

      if (!result.analytics) {
        await chrome.storage.local.set({
          analytics: {
            totalScans: 0,
            totalHiddenFees: 0,
            totalSavingsIdentified: 0,
            averageHiddenPercentage: 0,
            topOffendingSites: {},
            scansByMonth: {},
          },
        })
      }

      if (!result.settings) {
        await chrome.storage.local.set({
          settings: {
            maxHistoryItems: 50,
            enableNotifications: true,
            enableHighlighting: true,
            autoExport: false,
          },
        })
      }
    } catch (error) {
      console.error("[TrueCost] Storage initialization error:", error)
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "HIDDEN_FEES_DETECTED":
        this.handleHiddenFeesDetected(message.data, sender.tab.id)
        sendResponse({ success: true })
        break

      case "GET_TRANSACTION_HISTORY":
        this.getTransactionHistory(sendResponse)
        break

      case "SAVE_TRANSACTION":
        this.saveTransaction(message.data, sendResponse)
        break

      case "GET_ANALYTICS":
        this.getAnalytics(sendResponse)
        break

      case "EXPORT_HISTORY":
        this.exportHistory(message.format, sendResponse)
        break

      case "CLEAR_HISTORY":
        this.clearHistory(sendResponse)
        break

      case "DELETE_TRANSACTION":
        this.deleteTransaction(message.transactionId, sendResponse)
        break

      case "GET_SETTINGS":
        this.getSettings(sendResponse)
        break

      case "UPDATE_SETTINGS":
        this.updateSettings(message.settings, sendResponse)
        break

      default:
        sendResponse({ error: "Unknown message type" })
    }
  }

  handleHiddenFeesDetected(feeData, tabId) {
    const hiddenAmount = feeData.hiddenCharges
    const percentage = feeData.hiddenPercentage

    if (hiddenAmount > 0) {
      // Update badge to show hidden fees detected
      this.setBadgeText("!", tabId)
      this.setBadgeColor("#FF4444", tabId)

      // Show notification
      this.showNotification(
        "Hidden Fees Detected!",
        `Extra ${percentage}% (₹${hiddenAmount}) in hidden charges found`,
        tabId,
      )
    } else {
      this.setBadgeText("✓", tabId)
      this.setBadgeColor("#4CAF50", tabId)
    }

    this.updateAnalytics(feeData)
  }

  async getTransactionHistory(sendResponse) {
    try {
      const result = await chrome.storage.local.get(["transactionHistory"])
      const history = result.transactionHistory || []
      sendResponse({ success: true, data: history })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  async saveTransaction(transactionData, sendResponse) {
    try {
      const result = await chrome.storage.local.get(["transactionHistory", "settings"])
      let history = result.transactionHistory || []
      const settings = result.settings || { maxHistoryItems: 50 }

      // Add new transaction with enhanced metadata
      const transaction = {
        ...transactionData,
        timestamp: Date.now(),
        id: Date.now().toString(),
        dateString: new Date().toISOString(),
        userAgent: navigator.userAgent,
        pageTitle: transactionData.pageTitle || "Unknown Page",
        categories: this.categorizeTransaction(transactionData),
      }

      history.unshift(transaction)

      // Keep only specified number of transactions
      if (history.length > settings.maxHistoryItems) {
        history = history.slice(0, settings.maxHistoryItems)
      }

      await chrome.storage.local.set({ transactionHistory: history })
      sendResponse({ success: true })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  async updateAnalytics(feeData) {
    try {
      const result = await chrome.storage.local.get(["analytics"])
      const analytics = result.analytics || {
        totalScans: 0,
        totalHiddenFees: 0,
        totalSavingsIdentified: 0,
        averageHiddenPercentage: 0,
        topOffendingSites: {},
        scansByMonth: {},
      }

      // Update analytics
      analytics.totalScans += 1
      analytics.totalHiddenFees += feeData.hiddenCharges

      // Update average percentage
      analytics.averageHiddenPercentage = Math.round(
        (analytics.averageHiddenPercentage * (analytics.totalScans - 1) + feeData.hiddenPercentage) /
          analytics.totalScans,
      )

      // Track offending sites
      if (feeData.hiddenCharges > 0) {
        if (!analytics.topOffendingSites[feeData.site]) {
          analytics.topOffendingSites[feeData.site] = {
            count: 0,
            totalFees: 0,
            averagePercentage: 0,
          }
        }

        const siteData = analytics.topOffendingSites[feeData.site]
        siteData.count += 1
        siteData.totalFees += feeData.hiddenCharges
        siteData.averagePercentage = Math.round(
          (siteData.averagePercentage * (siteData.count - 1) + feeData.hiddenPercentage) / siteData.count,
        )
      }

      // Track scans by month
      const monthKey = new Date().toISOString().substring(0, 7) // YYYY-MM
      analytics.scansByMonth[monthKey] = (analytics.scansByMonth[monthKey] || 0) + 1

      await chrome.storage.local.set({ analytics })
    } catch (error) {
      console.error("[TrueCost] Analytics update error:", error)
    }
  }

  categorizeTransaction(transactionData) {
    const categories = []
    const site = transactionData.site.toLowerCase()

    // E-commerce categories
    if (site.includes("amazon") || site.includes("flipkart") || site.includes("myntra")) {
      categories.push("E-commerce")
    }

    // Food delivery
    if (site.includes("zomato") || site.includes("swiggy") || (site.includes("uber") && site.includes("eats"))) {
      categories.push("Food Delivery")
    }

    // Travel
    if (
      site.includes("makemytrip") ||
      site.includes("goibibo") ||
      site.includes("booking") ||
      site.includes("airbnb")
    ) {
      categories.push("Travel")
    }

    // Entertainment
    if (site.includes("bookmyshow") || site.includes("netflix") || site.includes("spotify")) {
      categories.push("Entertainment")
    }

    // Fee type categories
    if (transactionData.convenienceFee > 0) {
      categories.push("Convenience Fee")
    }
    if (transactionData.deliveryFee > 0) {
      categories.push("Delivery Fee")
    }
    if (transactionData.taxes > 0) {
      categories.push("Taxes")
    }

    return categories.length > 0 ? categories : ["Other"]
  }

  async getAnalytics(sendResponse) {
    try {
      const result = await chrome.storage.local.get(["analytics"])
      const analytics = result.analytics || {}
      sendResponse({ success: true, data: analytics })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  async exportHistory(format, sendResponse) {
    try {
      const result = await chrome.storage.local.get(["transactionHistory"])
      const history = result.transactionHistory || []

      let exportData
      let filename
      let mimeType

      switch (format) {
        case "json":
          exportData = JSON.stringify(history, null, 2)
          filename = `truecost-history-${new Date().toISOString().split("T")[0]}.json`
          mimeType = "application/json"
          break

        case "csv":
          exportData = this.convertToCSV(history)
          filename = `truecost-history-${new Date().toISOString().split("T")[0]}.csv`
          mimeType = "text/csv"
          break

        default:
          throw new Error("Unsupported export format")
      }

      // Create download
      const blob = new Blob([exportData], { type: mimeType })
      const url = URL.createObjectURL(blob)

      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true,
      })

      sendResponse({ success: true, filename })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  convertToCSV(history) {
    if (history.length === 0) return "No data available"

    const headers = [
      "Date",
      "Site",
      "Base Price",
      "Delivery Fee",
      "Convenience Fee",
      "Taxes",
      "Other Fees",
      "Total",
      "Hidden Charges",
      "Hidden Percentage",
      "Currency",
      "Categories",
    ]

    const rows = history.map((transaction) => [
      new Date(transaction.timestamp).toLocaleString(),
      transaction.site,
      transaction.basePrice || 0,
      transaction.deliveryFee || 0,
      transaction.convenienceFee || 0,
      transaction.taxes || 0,
      transaction.otherFees || 0,
      transaction.total || 0,
      transaction.hiddenCharges || 0,
      transaction.hiddenPercentage || 0,
      transaction.currency || "₹",
      (transaction.categories || []).join("; "),
    ])

    return [headers, ...rows].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")
  }

  async clearHistory(sendResponse) {
    try {
      await chrome.storage.local.set({ transactionHistory: [] })
      sendResponse({ success: true })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  async deleteTransaction(transactionId, sendResponse) {
    try {
      const result = await chrome.storage.local.get(["transactionHistory"])
      let history = result.transactionHistory || []

      history = history.filter((transaction) => transaction.id !== transactionId)

      await chrome.storage.local.set({ transactionHistory: history })
      sendResponse({ success: true })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  async getSettings(sendResponse) {
    try {
      const result = await chrome.storage.local.get(["settings"])
      const settings = result.settings || {
        maxHistoryItems: 50,
        enableNotifications: true,
        enableHighlighting: true,
        autoExport: false,
      }
      sendResponse({ success: true, data: settings })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  async updateSettings(newSettings, sendResponse) {
    try {
      const result = await chrome.storage.local.get(["settings"])
      const currentSettings = result.settings || {}

      const updatedSettings = { ...currentSettings, ...newSettings }

      await chrome.storage.local.set({ settings: updatedSettings })
      sendResponse({ success: true })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  setBadgeText(text, tabId = null) {
    if (tabId) {
      chrome.action.setBadgeText({ text, tabId })
    } else {
      chrome.action.setBadgeText({ text })
    }
  }

  setBadgeColor(color, tabId = null) {
    if (tabId) {
      chrome.action.setBadgeBackgroundColor({ color, tabId })
    } else {
      chrome.action.setBadgeBackgroundColor({ color })
    }
  }

  resetBadgeForTab(tabId) {
    this.setBadgeText("", tabId)
  }

  showNotification(title, message, tabId) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: title,
      message: message,
      priority: 1,
    })
  }
}

// Initialize background service
new TrueCostBackground()
