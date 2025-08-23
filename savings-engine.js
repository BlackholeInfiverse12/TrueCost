// TrueCost Savings Suggestion Engine
class SavingsEngine {
  constructor() {
    this.alternativeSites = {
      // E-commerce alternatives
      "amazon.in": ["flipkart.com", "myntra.com", "ajio.com"],
      "flipkart.com": ["amazon.in", "myntra.com", "snapdeal.com"],
      "myntra.com": ["ajio.com", "nykaa.com", "amazon.in"],

      // Food delivery alternatives
      "zomato.com": ["swiggy.com", "ubereats.com"],
      "swiggy.com": ["zomato.com", "dominos.co.in"],

      // Travel alternatives
      "makemytrip.com": ["goibibo.com", "cleartrip.com", "booking.com"],
      "goibibo.com": ["makemytrip.com", "yatra.com", "expedia.co.in"],
      "booking.com": ["agoda.com", "hotels.com", "makemytrip.com"],

      // Entertainment alternatives
      "bookmyshow.com": ["paytm.com", "insider.in"],
      "netflix.com": ["primevideo.com", "hotstar.com", "sonyliv.com"],
    }

    this.paymentMethods = {
      upi: { name: "UPI", feeReduction: 100, description: "Zero convenience fees" },
      netbanking: { name: "Net Banking", feeReduction: 50, description: "Lower processing fees" },
      wallet: { name: "Digital Wallet", feeReduction: 75, description: "Cashback offers available" },
      cod: { name: "Cash on Delivery", feeReduction: 100, description: "No payment processing fees" },
    }

    this.seasonalOffers = {
      festival: { months: [9, 10, 11], discount: 20, description: "Festival season discounts" },
      summer: { months: [3, 4, 5], discount: 15, description: "Summer sale offers" },
      winter: { months: [12, 1, 2], discount: 25, description: "Winter clearance sales" },
      monsoon: { months: [6, 7, 8], discount: 10, description: "Monsoon special offers" },
    }
  }

  async generateSuggestions(transactionData, userHistory = []) {
    const suggestions = []

    // Payment method suggestions
    suggestions.push(...this.getPaymentSuggestions(transactionData))

    // Delivery optimization suggestions
    suggestions.push(...this.getDeliverySuggestions(transactionData))

    // Alternative platform suggestions
    suggestions.push(...this.getAlternativeSuggestions(transactionData, userHistory))

    // Timing-based suggestions
    suggestions.push(...this.getTimingSuggestions(transactionData))

    // Bulk purchase suggestions
    suggestions.push(...this.getBulkSuggestions(transactionData, userHistory))

    // Cashback and rewards suggestions
    suggestions.push(...this.getCashbackSuggestions(transactionData))

    // Monetization suggestions (affiliate opportunities)
    suggestions.push(...this.getMonetizationSuggestions(transactionData))

    // Sort by potential savings
    return suggestions.sort((a, b) => (b.savings || 0) - (a.savings || 0))
  }

  getPaymentSuggestions(data) {
    const suggestions = []

    if (data.convenienceFee > 0) {
      // UPI suggestion
      suggestions.push({
        type: "payment",
        category: "Payment Method",
        title: "Switch to UPI Payment",
        description: `Save ${data.currency}${data.convenienceFee} by using UPI instead of cards`,
        savings: data.convenienceFee,
        savingsPercentage: Math.round((data.convenienceFee / data.total) * 100),
        actionable: true,
        priority: "high",
        icon: "💳",
        steps: [
          "Look for UPI payment option at checkout",
          "Use Google Pay, PhonePe, or Paytm",
          "Scan QR code or enter UPI ID",
          "Complete payment without convenience fees",
        ],
      })

      // Net banking suggestion
      if (data.convenienceFee > 20) {
        suggestions.push({
          type: "payment",
          category: "Payment Method",
          title: "Try Net Banking",
          description: `Net banking often has lower fees than cards`,
          savings: Math.round(data.convenienceFee * 0.5),
          savingsPercentage: Math.round(((data.convenienceFee * 0.5) / data.total) * 100),
          actionable: true,
          priority: "medium",
          icon: "🏦",
        })
      }
    }

    return suggestions
  }

  getDeliverySuggestions(data) {
    const suggestions = []

    if (data.deliveryFee > 0) {
      // Free delivery threshold
      const freeDeliveryThreshold = this.estimateFreeDeliveryThreshold(data.site)
      if (freeDeliveryThreshold && data.basePrice < freeDeliveryThreshold) {
        const additionalAmount = freeDeliveryThreshold - data.basePrice
        suggestions.push({
          type: "delivery",
          category: "Delivery Optimization",
          title: "Reach Free Delivery Threshold",
          description: `Add ${data.currency}${additionalAmount} more to get free delivery`,
          savings: data.deliveryFee - additionalAmount,
          savingsPercentage: Math.round(((data.deliveryFee - additionalAmount) / data.total) * 100),
          actionable: true,
          priority: additionalAmount < data.deliveryFee ? "high" : "low",
          icon: "🚚",
        })
      }

      // Pickup option
      suggestions.push({
        type: "delivery",
        category: "Delivery Optimization",
        title: "Choose Store Pickup",
        description: `Save ${data.currency}${data.deliveryFee} with in-store pickup`,
        savings: data.deliveryFee,
        savingsPercentage: Math.round((data.deliveryFee / data.total) * 100),
        actionable: true,
        priority: "medium",
        icon: "🏪",
      })

      // Delivery timing
      suggestions.push({
        type: "delivery",
        category: "Delivery Optimization",
        title: "Choose Standard Delivery",
        description: "Opt for slower delivery to reduce charges",
        savings: Math.round(data.deliveryFee * 0.3),
        actionable: true,
        priority: "low",
        icon: "📦",
      })
    }

    return suggestions
  }

  getAlternativeSuggestions(data, userHistory) {
    const suggestions = []
    const alternatives = this.alternativeSites[data.site] || []

    if (alternatives.length > 0 && data.hiddenPercentage > 10) {
      alternatives.slice(0, 2).forEach((altSite) => {
        suggestions.push({
          type: "alternative",
          category: "Alternative Platform",
          title: `Check ${altSite}`,
          description: `Compare prices on ${altSite} - often has better deals`,
          savings: Math.round(data.hiddenCharges * 0.7), // Estimated savings
          savingsPercentage: Math.round(((data.hiddenCharges * 0.7) / data.total) * 100),
          actionable: true,
          priority: "medium",
          icon: "🔄",
          link: `https://${altSite}`,
          affiliate: true, // Mark for potential monetization
        })
      })
    }

    // Historical comparison
    const similarTransactions = userHistory.filter(
      (t) => t.site === data.site && Math.abs(t.basePrice - data.basePrice) < data.basePrice * 0.2,
    )

    if (similarTransactions.length > 0) {
      const avgHiddenFees =
        similarTransactions.reduce((sum, t) => sum + t.hiddenCharges, 0) / similarTransactions.length
      if (data.hiddenCharges > avgHiddenFees * 1.2) {
        suggestions.push({
          type: "historical",
          category: "Price Alert",
          title: "Higher Fees Than Usual",
          description: `This site usually charges ${Math.round(avgHiddenFees)}% less in fees`,
          savings: Math.round(data.hiddenCharges - avgHiddenFees),
          actionable: false,
          priority: "high",
          icon: "📊",
        })
      }
    }

    return suggestions
  }

  getTimingSuggestions(data) {
    const suggestions = []
    const currentMonth = new Date().getMonth() + 1

    // Seasonal offers
    Object.entries(this.seasonalOffers).forEach(([season, offer]) => {
      if (offer.months.includes(currentMonth)) {
        suggestions.push({
          type: "timing",
          category: "Seasonal Savings",
          title: `${season.charAt(0).toUpperCase() + season.slice(1)} Sale Active`,
          description: `${offer.description} - up to ${offer.discount}% off`,
          savings: Math.round(data.basePrice * (offer.discount / 100)),
          actionable: true,
          priority: "medium",
          icon: "🎉",
        })
      }
    })

    // Weekend/weekday pricing
    const isWeekend = [0, 6].includes(new Date().getDay())
    if (isWeekend && data.site.includes("travel")) {
      suggestions.push({
        type: "timing",
        category: "Timing Optimization",
        title: "Consider Weekday Booking",
        description: "Travel bookings are often cheaper on weekdays",
        savings: Math.round(data.basePrice * 0.15),
        actionable: true,
        priority: "low",
        icon: "📅",
      })
    }

    return suggestions
  }

  getBulkSuggestions(data, userHistory) {
    const suggestions = []

    // Frequent purchases
    const siteHistory = userHistory.filter((t) => t.site === data.site)
    if (siteHistory.length >= 3) {
      const avgMonthlySpend = siteHistory.reduce((sum, t) => sum + t.total, 0) / 3

      if (avgMonthlySpend > data.total * 2) {
        suggestions.push({
          type: "bulk",
          category: "Bulk Purchase",
          title: "Consider Bulk Buying",
          description: "You shop here frequently - bulk orders often have better rates",
          savings: Math.round(data.hiddenCharges * 0.4),
          actionable: true,
          priority: "medium",
          icon: "📦",
        })
      }
    }

    return suggestions
  }

  getCashbackSuggestions(data) {
    const suggestions = []

    // Credit card cashback
    if (data.convenienceFee > 0) {
      suggestions.push({
        type: "cashback",
        category: "Rewards & Cashback",
        title: "Use Cashback Credit Card",
        description: "Get 1-5% cashback to offset convenience fees",
        savings: Math.round(data.total * 0.02), // 2% average cashback
        actionable: true,
        priority: "low",
        icon: "💰",
      })
    }

    // Loyalty programs
    suggestions.push({
      type: "loyalty",
      category: "Rewards & Cashback",
      title: "Join Loyalty Program",
      description: "Earn points and get exclusive discounts",
      savings: Math.round(data.total * 0.05), // 5% estimated value
      actionable: true,
      priority: "low",
      icon: "⭐",
    })

    return suggestions
  }

  getMonetizationSuggestions(data) {
    const suggestions = []

    // Affiliate link suggestions (monetization hook)
    if (data.hiddenCharges > 50) {
      suggestions.push({
        type: "affiliate",
        category: "Partner Offers",
        title: "Exclusive Partner Deal",
        description: `Save ${data.currency}${Math.round(data.hiddenCharges * 0.8)} on partner platform`,
        savings: Math.round(data.hiddenCharges * 0.8),
        actionable: true,
        priority: "high",
        icon: "🎯",
        isPartnerOffer: true,
        ctaText: "View Partner Deal",
        affiliate: true,
      })
    }

    // Premium app promotion
    suggestions.push({
      type: "premium",
      category: "TrueCost Premium",
      title: "Unlock Advanced Savings",
      description: "Get real-time price alerts and exclusive deals across all apps",
      savings: 0,
      actionable: true,
      priority: "low",
      icon: "🚀",
      isPremiumFeature: true,
      ctaText: "Learn More",
    })

    return suggestions
  }

  estimateFreeDeliveryThreshold(site) {
    const thresholds = {
      "amazon.in": 499,
      "flipkart.com": 500,
      "myntra.com": 799,
      "nykaa.com": 399,
      "bigbasket.com": 200,
    }

    return thresholds[site] || 500 // Default threshold
  }

  // Get personalized suggestions based on user behavior
  async getPersonalizedSuggestions(data, userPreferences = {}) {
    const suggestions = []

    // Based on user's preferred payment methods
    if (userPreferences.preferredPayment === "upi" && data.convenienceFee > 0) {
      suggestions.push({
        type: "personalized",
        category: "Your Preferences",
        title: "Your Preferred UPI Available",
        description: "Use your preferred UPI payment to avoid fees",
        savings: data.convenienceFee,
        actionable: true,
        priority: "high",
        icon: "👤",
      })
    }

    // Based on user's location
    if (userPreferences.location && data.deliveryFee > 0) {
      suggestions.push({
        type: "location",
        category: "Location-based",
        title: "Nearby Store Available",
        description: `Store in ${userPreferences.location} offers pickup`,
        savings: data.deliveryFee,
        actionable: true,
        priority: "medium",
        icon: "📍",
      })
    }

    return suggestions
  }
}

// Export for use in popup
if (typeof module !== "undefined" && module.exports) {
  module.exports = SavingsEngine
} else {
  window.SavingsEngine = SavingsEngine
}
