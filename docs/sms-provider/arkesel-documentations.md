# **Technical Evaluation and Integration Planning Report: Arkesel SMS and OTP API Suitability for Ghana**

## Current Platform Integration Notes

The API integrates Arkesel only behind the modular SMS provider seam. Use
`SMS_PROVIDER=mock` for local/dev/test and `SMS_PROVIDER=arkesel` for real
delivery. API keys, sender IDs, and webhook signing configuration are
server-side only and must not be exposed to frontend apps.

The current slice uses Arkesel for transactional SMS and invitation delivery.
Firebase Phone Auth remains the phone authentication provider; do not migrate
auth OTP to Arkesel without a separate auth design.

Configured sender IDs must be 1-11 alphanumeric characters with at least one
letter. Avoid spaces, punctuation, special symbols, and emojis. MTN Ghana
requires approval before a branded sender ID can deliver reliably.

Delivery reports should be configured to call
`POST /sms/webhooks/arkesel/delivery`. Public Arkesel docs do not confirm
webhook signatures; the endpoint accepts unsigned reports unless
`ARKESEL_WEBHOOK_SIGNATURE_SECRET` is configured, in which case it fails closed
when the configured signature header is missing or invalid. Before production,
ask Arkesel support to confirm webhook signature details, outbound IP ranges,
webhook retry policy, API rate limits, and any MTN sender ID fees.

## **Suitability Analysis of Arkesel for Platform Requirements**

The platform requires a robust, scalable, and highly reliable messaging infrastructure to coordinate interactions among agricultural stakeholders in Ghana, including farmers, buyers, transporters, warehouse agents, and system administrators1. Given that these stakeholders frequently operate in rural or semi-urban environments with variable internet connectivity and a high concentration of basic feature phones, short message service (SMS) technology represents the most viable communication channel2.  
To support the operational notifications required by the platform, Arkesel's Bulk SMS and One-Time Password (OTP) APIs provide direct mobile network operator (MNO) connections to all major Ghanaian telecommunication providers, including MTN Ghana, Telecel Ghana (formerly Vodafone), and AirtelTigo4. This bypasses intermediary aggregator routing paths, resulting in average message delivery speeds of under three seconds and a platform uptime guarantee of 99.9%1.  
The main operational use cases for the platform map directly to Arkesel's technical capabilities:

* **Warehouse Agent Invitations**: The V2 SMS API supports standard text containing hyperlinks, enabling the secure transmission of dynamic invitation URLs to approved agents4.  
* **Farmer Lifecycle Notifications**: The high throughput of the gateway allows the automated dispatch of transactional updates (such as crop receipt confirmations, storage fee reminders, reserve notices, sales receipts, and payment records) without message queuing delays1.  
* **Buyer and Transporter Notifications**: Automated transactional dispatch changes, dispatch assignments, and cancellation alerts can be triggered immediately via webhook events in the platform's backend1.  
* **Multi-Factor Authentication (MFA)**: For administrators and warehouse managers, Arkesel provides a managed OTP API that supports multi-channel verification fallback via voice or interactive unstructured supplementary service data (USSD)7. This architecture is critical for maintaining authentication integrity when local SMS congestion occurs7.  
* **Future Custom OTP Integration**: The flexibility of the standard V2 SMS API allows the platform to replace Firebase Phone Auth or a managed OTP service in the future by generating cryptographically secure codes on its own backend and routing them as standard transactional messages10.

## **API Architecture, Access, and Authentication Summary**

The Arkesel SMS API operates on a RESTful architecture, allowing standard HTTP requests to be executed from any modern development stack without mandatory software development kit (SDK) installations11. Security is enforced through an API-key-based authentication pattern11.  
Developers manage credentials through the unified dashboard located at account.arkesel.com12. To prevent credential sharing across distinct environments, Arkesel utilizes a Multi-API Key paradigm12. Under this framework, unique API keys are generated and scoped to specific application deployments, isolated as detailed in the table below:

| Feature | Staging / Sandbox Key | Live Production Key |
| :---- | :---- | :---- |
| **Authentication Header** | api-key1 or X-API-Token14 | api-key1 or X-API-Token14 |
| **Billing Scope** | Unbilled; test credits remain untouched13 | Deducts GHS credits from the active prepaid balance9 |
| **Carrier Handset Delivery** | Simulated; messages do not route to the mobile network13 | Dispatched directly to carriers for handset termination4 |
| **Log Availability** | Visible in the platform SMS history log13 | Logged under standard operational records and delivery webhooks4 |
| **Dashboard Management** | Key rotation, deletion, and scoping9 | Scopes can be restricted by IP address and usage limit4 |

Any compromised API keys can be immediately revoked and regenerated from the administrative interface without interrupting other active deployments11. Security standards mandate that these keys are kept out of client-side application code or public repositories, and should instead be loaded into backend environments as encrypted variables4.

## **Technical API Endpoint Specifications**

Arkesel currently supports both its legacy V1 API and its modern, JSON-based V2 API13. The integration planning team must prioritize the V2 REST API for all development streams due to its native handling of structured JSON and structured error codes1.

### **API Endpoint and Parameter Comparison**

| Characteristic | Legacy API (V1) | Modern API (V2) |
| :---- | :---- | :---- |
| **Target URL** | https://sms.arkesel.com/sms/api \[cite: 13\] | https://sms.arkesel.com/api/v2/sms/send \[cite: 1, 4, 12\] |
| **HTTP Method** | GET or POST13 | POST1 |
| **Content-Type** | application/x-www-form-urlencoded | application/json \[cite: 1, 13\] |
| **Auth Delivery** | Query parameter (api\_key)13 | Request Header (api-key)1 |
| **Recipient Format** | Comma-separated string13 | JSON Array of strings1 |
| **Payload Action Parameter** | Required ("action": "send-sms")13 | Omitted (implied by URL pathway)1 |

### **Phone Number Formatting and Recipient Structures**

All destination numbers must be structured using the E.164 international standard format4. For Ghanaian recipients, the country code prefix \+233 (or its numeric equivalent 233\) must be appended, followed by the nine-digit mobile number4.

* **V1 Structure**: "to": "233544919953,233244000000"  
  \[cite: 13\]  
* **V2 Structure**: "recipients": \["+233544919953", "+233244000000"\]  
  \[cite: 1, 11\]

The API natively supports both single and multi-recipient dispatches within a single HTTP POST request, optimizing backend throughput1.

### **Request and Response Payload Blueprints (V2 SMS)**

#### **Example Request Payload**

JSON  
POST /api/v2/sms/send HTTP/1.1  
Host: sms.arkesel.com  
api-key: a3FvY2thbGlkX3NlY3VyZV9wcm9kdWN0aW9uX2tleV8xMjc4OTAK  
Content-Type: application/json

{  
  "sender": "AgriPlatform",  
  "message": "Notification: Produce received at Warehouse A. Receipt \#REC9820 has been generated.",  
  "recipients": \[  
    "+233244000000"  
  \]  
}

#### **Example Success Response Payload**

JSON  
HTTP/1.1 200 OK  
Content-Type: application/json

{
  "status": "success",
  "data": [
    {
      "recipient": "+233244000000",
      "id": "msg_9f8k2j785a90123b"
    }
  ]
}

#### **Example Validation Error Response Payload**

When validation fails, such as when providing an invalid phone number or a malformed JSON payload, the platform returns a standard validation error structure11:

JSON  
HTTP/1.1 422 Unprocessable Entity  
Content-Type: application/json

{  
  "code": "422",  
  "message": "Validation Errors (Missing required field or invalid format)"  
}

## **Sender ID Requirements and Operator Approvals in Ghana**

                 \+--------------------------------------+  
                 |      Platform Administration         |  
                 \+-------------------+------------------+  
                                     |  
           Submits Trade License,    |    SLA:  
           Authorization Letter,     |    24 to 72 Hours  
           and Alphanumeric ID string|     
                                     v  
                 \+--------------------------------------+  
                 |     Arkesel Support Gateway          |  
                 \+-------------------+------------------+  
                                     |  
               Carrier Level Registration (MTN SLA: \~2 weeks)  
                                     |  
         \+---------------------------+---------------------------+  
         |                           |                           |  
         v                           v                           v  
\+------------------+        \+------------------+        \+------------------+  
|    MTN Ghana     |        |  Telecel Ghana   |        |   AirtelTigo     |  
| (Pre-registered  |        | (Sender Approved |        | (Sender Approved |  
|  ID Required)    |        |  by Carrier)     |        |  by Carrier)     |  
\+------------------+        \+------------------+        \+------------------+

To display a custom brand name (such as "AgriPlatform") instead of a random long number on recipients' handsets, the platform must register its Sender ID5. In Ghana, this process is managed directly by the mobile carriers through the SMS gateway provider15.  
The National Communications Authority (NCA) of Ghana does not require individual businesses to register Sender IDs directly with the regulator; instead, the regulator mandates that carriers verify and clearly display the sender's identity to prevent fraud15. Consequently, all registration and verification workflows are completed directly through the Arkesel platform5.

### **Alphanumeric Formatting Constraints**

Alphanumeric Sender ID configurations must comply with strict carrier-enforced parameters to prevent transmission errors13:

* **Length**: The ID string must be between 1 and 11 characters, including spaces13. Any configuration exceeding 11 characters will cause delivery failures13.  
* **Characters**: Standard English letters (A-Z, a-z) and digits (0-9) are allowed17. The string must contain at least one alphabetical letter; a Sender ID containing only numeric characters behaves like a standard phone number on modern mobile platforms, which bypasses the branded sender display17.  
* **Prohibited Elements**: Special symbols (e.g., \#, \*, %) and emojis are restricted13. Spaces are highly discouraged as some operators truncate them or reject the payload17. Additionally, any attempt to impersonate registered financial institutions, state institutions, or telecommunication providers is strictly prohibited and will result in access revocation17.

### **Network-Specific Validation and SLA Durations**

MTN Ghana, the dominant carrier with the largest subscriber base, enforces strict Sender ID pre-registration18. Messages sent to MTN subscribers using an unverified Sender ID will be blocked18. While Telecel and AirtelTigo support dynamic or shared Sender IDs, using a registered, approved alphanumeric ID is strongly recommended to maintain sender trust across all networks15.

| Operator | Verification Status | Submission Requirements | Typical Approval SLA |
| :---- | :---- | :---- | :---- |
| **MTN Ghana** | Mandatory18 | Certificate of Incorporation, Trade License, and a formal signed authorization letter16 | Up to two weeks18 |
| **Telecel Ghana** | Recommended15 | Uploaded business registration documents and desired alphanumeric text16 | 24 to 72 hours16 |
| **AirtelTigo** | Recommended15 | Uploaded business registration documents and desired alphanumeric text16 | 24 to 72 hours16 |

## **Delivery Status Tracking and Webhook Architecture**

To track operational messages (such as transporter dispatch notices or buyer payment alerts), the system should avoid standard API polling4. Instead, the platform should register a public HTTPS callback endpoint in the Arkesel administrative dashboard to support push-based webhooks4.

### **Webhook Dispatch and Lifecycle Flow**

When sending an SMS, the integration team specifies a delivery webhook action flag13. Once the carrier network processes the message delivery, Arkesel sends an asynchronous HTTPS POST request containing a structured JSON payload to the platform's callback URL4.

\+--------------------+               (1) HTTP POST /send              \+--------------------+  
|                    | \---------------------------------------------\> |                    |  
|  Platform Backend  |                                                |  Arkesel API Gateway|  
|  Application Node  | \<--------------------------------------------- |                    |  
|                    |          (2) Return Message Tracking ID        \+--------------------+  
\+--------------------+                                                          |  
          ^                                                                     | (3) Route message  
          |                                                                     v  
          |                                                           \+--------------------+  
          |                      (5) Async HTTPS Webhook Callback     |   Target Mobile    |  
          \+---------------------------------------------------------- |   Network (MNO)    |  
                                  Status Update Payload               \+--------------------+  
                                                                                |  
                                                                                | (4) Confirm Receipt  
                                                                                v  
                                                                      \+--------------------+  
                                                                      | Recipient Handset  |  
                                                                      \+--------------------+

### **Callback Message Tracking ID and Webhook Status Codes**

When the platform submits a message request, the API returns one tracking ID per accepted recipient (e.g., msg\_9f8k2j785a90123b) in the initial response1. Each tracking ID must be stored with its recipient so delivery reports update the correct database record4. The platform should handle the following webhook status classifications:

| Webhook Status | System Mapping | Network Description | Action |
| :---- | :---- | :---- | :---- |
| delivered \[cite: 4\] | Message Received | Handset confirmed receipt4. | Update database record status. |
| pending \[cite: 4, 20\] | In Flight | Message queued; handset out of signal20. | Keep monitoring; await status update. |
| failed \[cite: 4\] | Handset Bounce | Handset off, absent subscriber, invalid number4. | Trigger retry logic or log delivery issue. |
| expired \[cite: 4\] | Carrier Timeout | Delivery window elapsed4. | Fall back to alternative channel. |
| rejected \[cite: 4\] | Carrier Block | Message blocked due to unapproved Sender ID or content4. | Alert system administrators immediately. |

### **Webhook Delivery Report Schema Example**

JSON  
{  
  "message\_id": "msg\_9f8k2j785a90123b",  
  "status": "delivered",  
  "recipient": "+233244000000",  
  "network": "MTN",  
  "timestamp": "2026-03-31T14:32:01Z",  
  "credits\_charged": 1  
}

## **Managed OTP and Multi-Channel Verification Support**

Arkesel provides a dedicated, managed Phone Verification API that abstracts the core logic of OTP systems7. This removes the need for developers to manage cryptographic token generation, database states, and validity windows7.

### **Dedicated OTP Generation and Verification Flow**

The platform's verification workflow utilizes two primary V2 endpoints7:

                     \[ User Session Initiated \]  
                                 |  
                                 v  
                     \[ 1\. Post to Generation Endpoint \]  
                     POST https://sms.arkesel.com/api/v2/otp/send   
                                 |  
         \+-----------------------+-----------------------+  
         | (SMS Primary Channel)                         | (Voice/USSD Fallback)  
         v                                               v  
\+------------------+                                    \+------------------+  
| Recipient SIM    |                                    | Automated Voice  |  
| Receives Code    |                                    | Call or Session  |  
\+--------+---------+                                    \+--------+---------+  
         |                                                       |  
         \+-----------------------+-------------------------------+  
                                 |  
                                 v  
                     \[ User Enters Received Code \]  
                                 |  
                                 v  
                     \[ 2\. Post to Verification Endpoint \]  
                     POST https://sms.arkesel.com/api/v2/otp/verify

### **Detailed OTP Parameters and Schema Specifications**

The behavior and parameters of the managed OTP service are outlined below:

| Parameter Field | Technical Requirements | Allowed Ranges / Enums | Description |
| :---- | :---- | :---- | :---- |
| sender\_id \[cite: 7\] | Required7 | String, up to 11 characters13 | The approved brand name displayed to the user7. |
| number \[cite: 7\] | Required7 | String, E.164 formatting7 | Target phone number7. |
| message \[cite: 7\] | Required7 | String, must contain %otp\_code% \[cite: 7, 14\] | The text template. The gateway replaces %otp\_code% with the actual numerical token7. |
| expiry \[cite: 7\] | Required7 | Integer, 1 to 30 minutes7 | The validity window after generation7. |
| length \[cite: 7\] | Required7 | Integer, 4 to 8 digits7 | Length of the generated code7. |
| medium \[cite: 7\] | Required7 | Enum: "sms", "voice", "ussd" \[cite: 7\] | Primary dispatch medium7. |
| type \[cite: 7\] | Required7 | Enum: "numeric", "alphanumeric" | Composition style of the verification token7. |

### **Request and Response Blueprint (OTP V2 API)**

#### **Step 1: Request OTP Generation and Dispatch**

JSON  
POST /api/v2/otp/send HTTP/1.1  
Host: sms.arkesel.com  
api-key: a3FvY2thbGlkX3NlY3VyZV9wcm9kdWN0aW9uX2tleV8xMjc4OTAK  
Content-Type: application/json

{  
  "expiry": 5,  
  "length": 6,  
  "medium": "sms",  
  "message": "Your AgriPlatform verification code is %otp\_code%. This code is valid for 5 minutes.",  
  "number": "+233244000000",  
  "sender\_id": "AgriPlatform",  
  "type": "numeric"  
}

Successful submission returns an HTTP 200 OK status containing a platform code and tracking details7:

JSON  
HTTP/1.1 200 OK  
Content-Type: application/json

{  
  "code": "1000",  
  "message": "Successful, OTP is being processed for delivery"  
}

#### **Step 2: Verification Check of User-Submitted Code**

When the user enters the code on the platform, the backend verifies it by sending a POST request to the verification endpoint7:

JSON  
POST /api/v2/otp/verify HTTP/1.1  
Host: sms.arkesel.com  
api-key: a3FvY2thbGlkX3NlY3VyZV9wcm9kdWN0aW9uX2tleV8xMjc4OTAK  
Content-Type: application/json

{  
  "code": "847291",  
  "number": "+233244000000"  
}

A successful matching code returns a positive confirmation response7:

JSON  
HTTP/1.1 200 OK  
Content-Type: application/json

{  
  "code": "1100",  
  "message": "Successful"  
}

If the verification fails due to an invalid code, an expired token, or a missing field, the platform returns specific error codes14:

* **Code 1101**: Validation Error (Missing required field)14  
* **Code 1104**: Invalid Code (Verification failed)14  
* **Code 1105**: Code Expired14

### **Reliability, Priority, and Custom Authentication Support**

To maintain security, Arkesel restricts OTP delivery routes to high-priority channels to minimize network delays6. If SMS delivery fails due to carrier network issues, the system can automatically fall back to Voice OTP (reading the code via phone call) or USSD delivery to ensure successful verification7.  
If the platform transitions away from Firebase Phone Auth and implements a custom authentication flow, it can generate and hash tokens locally, utilizing Arkesel's standard V2 SMS endpoint to send the messages10.

## **Pricing Structure for Ghana Operations**

The billing framework is structured as a prepaid model with tiered volume discounts5. This allow the integration planning team to estimate financial requirements without recurring license commitments5.

### **Ghana Pricing Models (Prepaid Credits in GHS)**

#### **Bulk SMS Cost Index — Expiring Credits (Valid for 3 Months)**

| Prepaid Level (GHS) | SMS Unit Allocation | Effective Per-SMS Cost (GHS) |
| :---- | :---- | :---- |
| **GHS 5,000** \[cite: 5, 23\] | 228,3115 | 0.02195 |
| **GHS 2,000** \[cite: 5, 23\] | 91,5335 | 0.02195 |
| **GHS 1,000** \[cite: 5, 23\] | 43,4785 | 0.02305 |
| **GHS 500** \[cite: 5, 23\] | 20,7045 | 0.02425 |
| **GHS 200** \[cite: 5, 23\] | 7,9055 | 0.02535 |
| **GHS 100** \[cite: 5, 23\] | 3,7815 | 0.02655 |
| **GHS 50** \[cite: 5, 23\] | 1,8125 | 0.02765 |
| **GHS 20** \[cite: 5, 23\] | 6965 | 0.02885 |

#### **Bulk SMS Cost Index — No-Expiry Credits**

| Prepaid Level (GHS) | SMS Unit Allocation | Effective Per-SMS Cost (GHS) |
| :---- | :---- | :---- |
| **GHS 5,000** \[cite: 5, 23\] | 208,3335 | 0.02505 |
| **GHS 2,000** \[cite: 5, 23\] | 80,0005 | 0.02505 |
| **GHS 1,000** \[cite: 5, 23\] | 38,4625 | 0.02605 |
| **GHS 500** \[cite: 5, 23\] | 18,5195 | 0.02705 |
| **GHS 200** \[cite: 5, 23\] | 7,1435 | 0.02805 |
| **GHS 100** \[cite: 5, 23\] | 3,4485 | 0.02905 |
| **GHS 50** \[cite: 5, 23\] | 1,66723 | 0.030023 |
| **GHS 20** \[cite: 5, 23\] | 64523 | 0.031023 |

#### **Specialized Messaging and Verification Channels**

| Action | Cost Structure | Operational Pricing | Notes |
| :---- | :---- | :---- | :---- |
| **Managed OTP SMS / USSD** | Flat per-verification fee7 | GHS 0.035 per delivery23 | Covers generation, SMS/USSD routing, and verification23. |
| **Voice Messaging (Bulk)** | Per-minute fee23 | GHS 0.15 per minute23 | Billed per-second; applies only to answered calls23. |
| **Voice OTP Verification** | Per-minute fee23 | GHS 0.20 per minute23 | High-priority voice fallback option7. |

### **Operational Surcharges, Platform Limits, and Delivery Reports**

* **Monthly Fees**: Arkesel does not charge monthly platform fees or subscription costs for SMS and OTP services5.  
* **Minimum Top-Up**: The minimum top-up allowed via mobile money or card is **GHS 20**5.  
* **DLR Tracking Costs**: Standard webhook pushes and online delivery report checks are included in the base per-SMS credit cost5.  
* **Multi-Country Routing**: If routing messages outside Ghana, pricing uses localized regional rates (such as Nigeria or South Africa) in local currencies, avoiding international exchange rate markups12.

## **Message Formatting, Unicode, and Concatenation Mechanics**

The platform backend must accurately calculate message segment counts before dispatches to optimize credit consumption18.

### **Character Limitations and Segment Calculation**

* **Standard GSM-7 Encoding**: Characters are encoded using standard 7-bit formatting15. A single SMS segment allows up to **160 characters**13.  
* **GSM-7 Concatenation**: When messages exceed 160 characters, the carrier automatically splits the content13. To ensure proper reassembly on the recipient's device, 7 characters per segment are reserved for User Data Header (UDH) formatting, reducing the maximum limit per segment to **153 characters**18.  
* **Unicode Encoding (UCS-2)**: The inclusion of any Unicode characters, such as non-Latin text or emojis, triggers UCS-2 encoding13. Under this standard, the single-segment limit drops to **70 characters**18.  
* **Unicode Concatenation**: Multi-segment Unicode messages are split into **67-character** blocks, significantly increasing credit consumption18.

### **Cost-Effectiveness and Payload Mechanics**

To prevent character-budget inflation, the platform must avoid emojis or non-standard characters in high-frequency notification loops.

| Encoding Type | Segment Count | Maximum Character Budget | Charged Credits |
| :---- | :---- | :---- | :---- |
| **GSM-7** | Single Segment | 160 characters13 | 1 Credit |
| **GSM-7** | Two Segments | 306 characters (2 x 153 characters)18 | 2 Credits |
| **GSM-7** | Three Segments | 459 characters (3 x 153 characters)18 | 3 Credits |
| **Unicode** | Single Segment | 70 characters18 | 1 Credit |
| **Unicode** | Two Segments | 134 characters (2 x 67 characters)18 | 2 Credits |
| **Unicode** | Three Segments | 201 characters (3 x 67 characters)18 | 3 Credits |

Each successful V2 SMS dispatch returns a credits\_used integer in the payload response, enabling precise cost tracking within the database layer1. Using standard messaging templates is optional, and pre-approval is not required for transactional SMS1.

## **Compliance, Consent, and Regional Guidelines**

All outbound messaging campaigns in Ghana must comply with the National Communications Authority (NCA) guidelines to maintain system access15.

### **NCA Quiet Hours for Promotional Campaigns**

The NCA's Amended Unsolicited Electronic Communications (UEC) Code of Conduct specifies clear operational windows for bulk messaging15. To protect consumers, **promotional (commercial) SMS may only be dispatched between 8:00 AM and 7:00 PM**15. Sending promotional messages on Sundays is prohibited17.  
Transactional SMS payloads—including verification codes, farmer transaction receipts, and driver dispatch orders—are exempt from quiet hours restrictions and can be sent 24/74.

### **User Consent and Opt-Out Requirements**

To comply with regulatory guidelines and maintain sender trust, the platform must enforce explicit opt-in and opt-out policies:

* **Opt-In Audits**: The platform must obtain explicit consent from recipients before sending any promotional messages, and keep a record of these opt-ins8.  
* **Explicit Opt-Out Opting**: Every promotional message must include a clear, automated mechanism for the recipient to unsubscribe, such as "Reply STOP"8.  
* **Processing Requirements**: The platform must process unsubscribe requests and update its active suppression list within 24 hours of receipt15.  
* **DND Lists**: In Ghana, transactional messages can bypass standard Do Not Disturb (DND) restrictions4. However, promotional campaigns must check the carrier DND list or handle DND rejection codes in webhook callbacks to maintain compliance4.

## **Testing, Sandbox Capabilities, and Developer Experience**

To ensure a seamless development cycle, Arkesel provides robust testing tools and support resources9.

                 \[ Platform Integration Node \]  
                               |  
         \+---------------------+---------------------+  
         | (Auth: Staging API Key)                   | (Auth: Production API Key)  
         v                                           v  
\+-----------------------------+             \+-----------------------------+  
|    1\. Sandbox Gateway V2    |             |   2\. Live Production API    |  
|   POST /api/v2/sms/send     |             |    POST /api/v2/sms/send    |  
\+--------------+--------------+             \+--------------+--------------+  
               |                                           |  
               v                                           v  
\+-----------------------------+             \+-----------------------------+  
| Simulated Delivery Callback |             | Carrier Transmission Loop   |  
|   \* No credit deduction     |             |   \* Real-time billing       |  
|   \* Visible in portal log   |             |   \* Delivery to handset     |  
|   \* Endpoint validations    |             |   \* Carrier webhooks fired  |  
\+-----------------------------+             \+-----------------------------+

### **Sandbox Capabilities**

The platform supports a simulated sandbox mode that replicates live API behavior without deducting prepaid credits or routing messages over mobile carrier networks9. Sandbox sends return simulated status responses and webhooks, allowing developers to safely test callback integrations9. These sandbox messages are logged and visible in the dashboard SMS history report13.

### **Language Support and Integration Pathways**

Arkesel supports direct integrations using standard HTTP requests, reducing the complexity of the platform's backend implementation11. The documentation includes code examples for common languages, including Python, JavaScript/Node.js, and PHP1. Additionally, community-maintained libraries (such as Laravel notification channels) are available for developers using standard web frameworks26.

## **Technical Gaps, Risk Mitigation, and Support Queries**

During this API documentation review, several technical gaps and security considerations were identified that are not fully addressed in Arkesel’s public developer portals4. The integration team should address these with Arkesel support before deploying to production4:

1. **Webhook Signature Verification**:  
   * *Documentation Status*: **Not found in documentation**4. While standard practices recommend validating webhook signatures, the documentation does not detail the signature algorithm or header structure used by Arkesel to authenticate delivery callbacks4.  
   * *Risk*: Potential spoofing of delivery webhooks could compromise transactional tracking records4.  
   * *Query to Support*: *Does the Arkesel system sign delivery webhooks? If so, what is the header format and validation mechanism?*  
     \[cite: 4\]  
2. **IP Allowlisting for Callback Endpoints**:  
   * *Documentation Status*: **Not found in documentation**4.  
   * *Risk*: Firewalls protecting the platform's internal databases must be configured to allow webhook traffic without exposing endpoints to public traffic29.  
   * *Query to Support*: *Can Arkesel provide a static IP address range for their outbound webhook servers?*  
     \[cite: 29, 31\]  
3. **Webhook Error Retry Mechanism**:  
   * *Documentation Status*: **Not found in documentation**4.  
   * *Risk*: Temporary network issues or platform server downtime could result in lost delivery status updates31.  
   * *Query to Support*: *What is Arkesel's retry policy and backing-off algorithm if the platform's callback URL returns a non-200 HTTP code?*  
     \[cite: 29, 31\]  
4. **MTN Ghana Alphanumeric Sender ID Fees**:  
   * *Documentation Status*: **Not found in documentation**18.  
   * *Risk*: Budget projections must account for potential setup fees, particularly for MTN Ghana18.  
   * *Query to Support*: *Are there any setup fees or recurring carrier charges for registering custom alphanumeric Sender IDs for MTN Ghana?*  
     \[cite: 18\]  
5. **API Rate Limiting Metrics**:  
   * *Documentation Status*: **Not found in documentation**21.  
   * *Risk*: High-frequency transactions, such as bulk harvest receipts, could trigger API rate limit errors21.  
   * *Query to Support*: *What are the specific per-second and per-minute rate limits enforced on V2 SMS and OTP endpoints?*  
     \[cite: 21, 32\]

## **Strategic Recommendations and Feasibility Verdict**

### **Feasibility Verdict: Highly Suitable**

Arkesel is highly suitable for supporting the platform's messaging requirements in Ghana1. The platform provides direct connections to local telecommunications providers (MTN, Telecel, AirtelTigo), maintaining low-latency delivery (\< 3s) for time-sensitive notifications to farmers, buyers, and transporters1.  
Additionally, the managed, multi-channel OTP API (supporting SMS fallback to Voice and USSD) provides a reliable authentication mechanism for administrators and managers in areas with limited mobile data2. The credit-based model offers a "No Expiry" option, which matches the seasonal nature of harvest cycles and prevents financial waste during off-season periods5.

### **Recommended Implementation Roadmap**

\+--------------------------------------------------------------------------+  
|                      PHASE 1: Core System Sandbox                        |  
|                                                                          |  
| \* Initialize developer credentials at account.arkesel.com. |  
| \* Deploy scoped Sandbox API keys to staging environments.   |  
| \* Implement base V2 JSON payload templates for messages.   |  
| \* Set up and test the platform's delivery webhook endpoints.|  
\+------------------------------------+-------------------------------------+  
                                     |  
                                     v  
\+--------------------------------------------------------------------------+  
|                     PHASE 2: Carrier-Level Registration                  |  
|                                                                          |  
| \* Submit formal authorization documents via Arkesel.      |  
| \* Initiate MTN Ghana Sender ID registration (2-week lead time).|  
| \* Configure fallback loops (SMS to Voice/USSD OTP).           |  
\+------------------------------------+-------------------------------------+  
                                     |  
                                     v  
\+--------------------------------------------------------------------------+  
|                     PHASE 3: Compliance & Go-Live                        |  
|                                                                          |  
| \* Configure campaign scheduling rules to respect quiet hours.|  
| \* Deploy dynamic character segmentation counters to prevent UCS-2 cost  |  
|   multiplication in notification templates.                    |  
| \* Transition environments to active production API keys \[cite: 9\].       |  
\+--------------------------------------------------------------------------+

#### **Works cited**

1. SMS API Ghana — Send OTP, Alerts & Bulk SMS | Arkesel, [https://arkesel.com/developer-api/sms-api/](https://arkesel.com/developer-api/sms-api/)  
2. USSD Code Provider in Ghana — Get a USSD Shortcode \- Arkesel, [https://arkesel.com/developer-api/ussd-api/](https://arkesel.com/developer-api/ussd-api/)  
3. SMS OTP vs Authenticator App vs Email OTP (2026 Guide) \- Arkesel, [https://arkesel.com/sms-otp-vs-authenticator-app-vs-email-otp/](https://arkesel.com/sms-otp-vs-authenticator-app-vs-email-otp/)  
4. Bulk SMS API Ghana: Developer Integration Guide (2026), [https://arkesel.com/bulk-sms-api-developers-ghana/](https://arkesel.com/bulk-sms-api-developers-ghana/)  
5. Bulk SMS in Ghana Reach customers at scale \- Arkesel, [https://arkesel.com/bulk-sms/ghana/](https://arkesel.com/bulk-sms/ghana/)  
6. Best OTP API Providers Compared for Africa (2026) \- Arkesel, [https://arkesel.com/otp-api-providers-comparison-2026/](https://arkesel.com/otp-api-providers-comparison-2026/)  
7. OTP API Ghana — Phone Number Verification for Banks & Fintech | Arkesel, [https://arkesel.com/phone-number-verification/](https://arkesel.com/phone-number-verification/)  
8. SMS Marketing Automation: How to Set Up Triggered Campaigns in Ghana (2026) \- Arkesel, [https://arkesel.com/sms-marketing-automation-triggered-campaigns/](https://arkesel.com/sms-marketing-automation-triggered-campaigns/)  
9. Developer APIs — SMS, USSD, Voice & OTP | Arkesel, [https://arkesel.com/developer-api/](https://arkesel.com/developer-api/)  
10. OTP API Integration Guide: SMS Verification (2026) \- Arkesel, [https://arkesel.com/5-simple-steps-to-integrate-sms-otp-apis-in-your-application/](https://arkesel.com/5-simple-steps-to-integrate-sms-otp-apis-in-your-application/)  
11. How to Send SMS via the Arkesel API: Developer Guide with Code Examples, [https://arkesel.com/how-to-send-sms-via-an-api-with-arkesel/](https://arkesel.com/how-to-send-sms-via-an-api-with-arkesel/)  
12. Arkesel SMS API Keys: Manage Multiple Apps & Projects, [https://arkesel.com/introduction-of-the-multi-api-key/](https://arkesel.com/introduction-of-the-multi-api-key/)  
13. Arkesel API | Documentation, [https://developers.arkesel.com/](https://developers.arkesel.com/)  
14. Failed to Generate OTP? 10 Fixes for Common API Errors \- Arkesel, [https://arkesel.com/troubleshooting-10-common-otp-api-integration-issues/](https://arkesel.com/troubleshooting-10-common-otp-api-integration-issues/)  
15. How to Send Bulk SMS in Ghana: NCA-Compliant Workflow \- Arkesel, [https://arkesel.com/how-to-send-bulk-sms-in-ghana/](https://arkesel.com/how-to-send-bulk-sms-in-ghana/)  
16. How to Send SMS With Company Name (Sender ID Setup Guide), [https://arkesel.com/how-to-send-sms-with-company-name-a-complete-guide/](https://arkesel.com/how-to-send-sms-with-company-name-a-complete-guide/)  
17. How to Send Bulk SMS with Your Sender ID (2026 Guide) \- Arkesel, [https://arkesel.com/how-to-send-bulk-sms-with-your-sender-id/](https://arkesel.com/how-to-send-bulk-sms-with-your-sender-id/)  
18. Bulk SMS Pricing in Ghana: What Determines the Cost (And How to Compare) \- Arkesel, [https://arkesel.com/bulk-sms-pricing-ghana/](https://arkesel.com/bulk-sms-pricing-ghana/)  
19. How to Create a USSD Code: Developer Guide for Africa, [https://arkesel.com/ussd-application-development-guide-africa/](https://arkesel.com/ussd-application-development-guide-africa/)  
20. SMS Gateway: What It Is and How to Choose for Africa \- Arkesel, [https://arkesel.com/best-bulk-sms-gateway-africa/](https://arkesel.com/best-bulk-sms-gateway-africa/)  
21. Arkesel API \- BuildStudio NG, [https://www.buildstudio.com.ng/apis/arkesel-api](https://www.buildstudio.com.ng/apis/arkesel-api)  
22. Send bulk SMS to customers across Africa \- Arkesel, [https://arkesel.com/bulk-sms/](https://arkesel.com/bulk-sms/)  
23. Check out our pricing plans, from free to paid. \- Arkesel, [https://arkesel.com/pricing/](https://arkesel.com/pricing/)  
24. SMS Marketing in Ghana: The Complete Guide (2026), [https://arkesel.com/sms-marketing-ghana-guide/](https://arkesel.com/sms-marketing-ghana-guide/)  
25. Developer-friendly communication APIs in Nigeria \- Arkesel, [https://arkesel.com/developer-api/nigeria/](https://arkesel.com/developer-api/nigeria/)  
26. Arkesel \- GitHub, [https://github.com/ArkeselDev](https://github.com/ArkeselDev)  
27. Bulk SMS, Payment, Voice, Email and USSD PHP SDK for Arkesel \- GitHub, [https://github.com/Parables/arkesel-sdk](https://github.com/Parables/arkesel-sdk)  
28. A Laravel package for Arkesel SMS API \- GitHub, [https://github.com/Freddywhest/arkesel-laravel](https://github.com/Freddywhest/arkesel-laravel)  
29. Webhook IP whitelisting \- GetAccept Help Center, [https://help.getaccept.com/en/articles/8570402-webhook-ip-whitelisting](https://help.getaccept.com/en/articles/8570402-webhook-ip-whitelisting)  
30. Static Outgoing IP Address | WebhookRelay, [https://webhookrelay.com/features/static-outgoing-ip/](https://webhookrelay.com/features/static-outgoing-ip/)  
31. Sending Webhooks to Firewalled Endpoints: Why Your Outbound IP Matters \- QuotaGuard, [https://www.quotaguard.com/blog/webhooks-behind-firewalls-static-ip-whitelisting](https://www.quotaguard.com/blog/webhooks-behind-firewalls-static-ip-whitelisting)  
32. OTP for Fintech Banking: Secure Transactions at Scale \- Arkesel, [https://arkesel.com/otp-fintech-banking-transaction-security/](https://arkesel.com/otp-fintech-banking-transaction-security/)
