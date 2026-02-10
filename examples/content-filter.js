// Example: Content Filtering and Moderation
// This example shows how to implement content filtering

module.exports = (robot) => {
  const adapter = robot.adapter
  
  if (!adapter.registerAuthzHook) {
    console.log('Authorization hooks not supported by this adapter')
    return
  }
  
  // Block messages containing profanity
  const profanityList = [
    'badword1',
    'badword2',
    'spam',
    // Add your own words here
  ]
  
  adapter.registerAuthzHook(async (action, context) => {
    if (action === 'message.send') {
      const text = context.text.toLowerCase()
      
      // Check for profanity
      for (const word of profanityList) {
        if (text.includes(word)) {
          return {
            allowed: false,
            reason: 'Message contains inappropriate content'
          }
        }
      }
      
      // Check for excessive caps (more than 70% uppercase)
      const uppercaseCount = (context.text.match(/[A-Z]/g) || []).length
      const letterCount = (context.text.match(/[A-Za-z]/g) || []).length
      
      if (letterCount > 5 && uppercaseCount / letterCount > 0.7) {
        return {
          allowed: false,
          reason: 'Please avoid excessive use of capital letters'
        }
      }
      
      // Check for very long messages
      if (context.text.length > 1000) {
        return {
          allowed: false,
          reason: 'Message is too long (max 1000 characters)'
        }
      }
      
      // Check for repeated characters
      if (/(.)\1{10,}/.test(context.text)) {
        return {
          allowed: false,
          reason: 'Message contains excessive repeated characters'
        }
      }
    }
    
    return { allowed: true }
  })
  
  console.log('Content filtering hooks registered')
}
