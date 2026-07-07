import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTransactionalSmsTemplateBudget,
  estimateSmsSegments,
  normalizeE164PhoneNumber,
  normalizeGhanaPhoneNumber,
  normalizeSmsDeliveryStatus,
  renderSmsTemplate,
} from "../src/index.ts";

test("normalizes Ghana phone numbers to E.164", () => {
  assert.equal(normalizeGhanaPhoneNumber("050 000 0000"), "+233500000000");
  assert.equal(normalizeGhanaPhoneNumber("233500000000"), "+233500000000");
  assert.equal(normalizeGhanaPhoneNumber("+233 50 000 0000"), "+233500000000");
  assert.throws(() => normalizeGhanaPhoneNumber("+15555550100"), /Ghana phone number/);
});

test("accepts already-normalized non-Ghana E.164 numbers only when explicitly using the generic helper", () => {
  assert.equal(normalizeE164PhoneNumber("+15555550100"), "+15555550100");
  assert.throws(() => normalizeE164PhoneNumber("555-0100"), /E.164/);
});

test("estimates GSM-7 and concatenated SMS segments", () => {
  assert.deepEqual(estimateSmsSegments("A".repeat(160)), {
    encoding: "gsm-7",
    characterCount: 160,
    encodedLength: 160,
    segments: 1,
    singleSegmentLimit: 160,
    multipartSegmentLimit: 153,
    credits: 1,
    isMultipart: false,
  });
  assert.equal(estimateSmsSegments("A".repeat(161)).segments, 2);
  assert.equal(estimateSmsSegments("^".repeat(80)).encodedLength, 160);
});

test("estimates UCS-2 SMS segments when text contains non-GSM characters", () => {
  const single = estimateSmsSegments("Akwaaba 😊");
  assert.equal(single.encoding, "ucs-2");
  assert.equal(single.segments, 1);
  assert.equal(estimateSmsSegments("é".repeat(161)).encoding, "gsm-7");
  assert.equal(estimateSmsSegments("Ā".repeat(71)).segments, 2);
});

test("normalizes provider delivery statuses", () => {
  assert.equal(normalizeSmsDeliveryStatus("delivered"), "delivered");
  assert.equal(normalizeSmsDeliveryStatus("queued"), "queued");
  assert.equal(normalizeSmsDeliveryStatus("rejected"), "rejected");
  assert.equal(normalizeSmsDeliveryStatus("unknown-provider-value"), "failed");
});

test("renders transactional SMS templates as compact GSM-friendly text", () => {
  const rendered = renderSmsTemplate({
    messageKind: "farmer_receipt",
    message: "Fallback should not be used",
    data: {
      receiptCode: "REC-100",
      quantity: 12,
      unit: "bags",
      cropType: "maize",
      warehouseName: "Tamale Central",
    },
  });

  assert.equal(rendered.templateKey, "farmer_receipt");
  assert.equal(rendered.segmentEstimate.encoding, "gsm-7");
  assert.match(rendered.message, /Kuapa receipt REC-100 12 bags maize at Tamale Central\./);
  assert.doesNotThrow(() => assertTransactionalSmsTemplateBudget({ message: rendered.message }));
});

test("generic SMS rendering removes non GSM-friendly decoration", () => {
  const rendered = renderSmsTemplate({
    templateKey: "generic_notification",
    message: "Sale paid \u2014 farmer credited \u2713",
  });

  assert.equal(rendered.message, "Sale paid farmer credited");
  assert.equal(rendered.segmentEstimate.encoding, "gsm-7");
});
