const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// EmailJS Configuration - Your actual credentials
const EMAILJS_SERVICE_ID = "service_ukczuhd";
const EMAILJS_TEMPLATE_ID = "template_6xg4dlf";
const EMAILJS_PUBLIC_KEY = "Q_T-QRBZA7RaVSp1WXxz-";

// 🚀 Automatic email trigger when new email is added to Firestore
exports.sendWelcomeEmail = onDocumentCreated("contact_emails/{emailId}", async (event) => {
  try {
    // Get the newly created document data
    const newEmailDoc = event.data.data();
    const userEmail = newEmailDoc.email;
    
    console.log(`🚀 New email added: ${userEmail}. Sending welcome email...`);

    // Prepare EmailJS payload with CORRECT template parameters
    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: userEmail,
        name: "Developer",  // ✅ Changed from user_name to name
        message: "We're building real-world projects and would love to have you join us!",
        time: new Date().toLocaleString('en-US', { 
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short'
        }),  // ✅ Added time parameter
        email: userEmail  // ✅ Added for Reply To field
      }
    };

    console.log('Sending EmailJS payload:', JSON.stringify(emailData, null, 2));

    // Send email via EmailJS API
    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', emailData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      console.log(`✅ Welcome email sent successfully to: ${userEmail}`);
      
      // Update the document to track email status
      await event.data.ref.update({
        welcomeEmailSent: true,
        welcomeEmailSentAt: FieldValue.serverTimestamp(),
        emailMethod: 'EmailJS'
      });
      
    } else {
      console.error(`❌ Failed to send email to ${userEmail}:`, response.data);
      
      // Mark as failed
      await event.data.ref.update({
        welcomeEmailSent: false,
        welcomeEmailError: 'EmailJS API returned non-200 status',
        welcomeEmailSentAt: FieldValue.serverTimestamp()
      });
    }

  } catch (error) {
    console.error('❌ Error in sendWelcomeEmail trigger:', error.message);
    console.error('Full error details:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers
    });
    
    // Update document to mark email as failed
    try {
      await event.data.ref.update({
        welcomeEmailSent: false,
        welcomeEmailError: `${error.response?.status}: ${JSON.stringify(error.response?.data)}`,
        welcomeEmailSentAt: FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('❌ Failed to update document with error status:', updateError);
    }
  }
});

// 📧 Manual email sending function (keeping for backwards compatibility)
exports.sendPersonalizedEmails = onRequest(async (req, res) => {
  try {
    const snapshot = await db.collection("contact_emails").get();
    const emailPromises = [];

    snapshot.forEach((doc) => {
      const { email } = doc.data();
      console.log("Sending email to:", email);

      const emailData = {
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: email,
          name: "Valued Member",  // ✅ Changed from user_name to name
          message: "Thank you for being part of our Developer's Cohort community!",
          time: new Date().toLocaleString('en-US', { 
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short'
          }),
          email: email
        }
      };

      emailPromises.push(
        axios.post('https://api.emailjs.com/api/v1.0/email/send', emailData, {
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch((error) => {
          console.error(`❌ Failed to send to ${email}:`, error.message);
        })
      );
    });

    await Promise.all(emailPromises);
    res.status(200).send("✅ Emails sent successfully via EmailJS.");
  } catch (err) {
    console.error("❌ Error sending emails:", err);
    res.status(500).send("❌ Failed to send emails.");
  }
});