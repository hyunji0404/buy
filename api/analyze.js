/* 이 Vercel 함수는 비밀 API 키로 OpenRouter에 이미지 분석을 요청합니다. */
"use strict";

const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";
const DEFAULT_FALLBACK_MODEL = "nvidia/nemotron-3.5-super-vl:free";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 128;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

module.exports = async function analyze(req, res) {
  // 함수는 업로드 요청만 받고, 잘못된 메서드는 모델 호출 전에 거절합니다.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "POST 요청만 사용할 수 있어요.", code: "METHOD_NOT_ALLOWED" });
  }

  // 비밀 키는 서버 환경변수에서만 읽고 클라이언트 응답에는 절대 포함하지 않습니다.
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, {
      error: "서버에 OpenRouter API 키가 설정되지 않았어요. 운영자에게 설정을 요청해 주세요.",
      code: "API_KEY_MISSING"
    });
  }

  let image;
  try {
    image = validateImage(req.body && req.body.imageDataUrl);
  } catch (error) {
    return sendJson(res, 400, { error: error.message, code: "INVALID_IMAGE" });
  }

  // 기본 모델과 429 전용 대체 모델을 배포 환경에서 설정할 수 있게 합니다.
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallbackModel = process.env.OPENROUTER_VISION_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  const prompt = createPrompt();

  try {
    let result;
    try {
      result = await requestModel({ apiKey, model, image, prompt });
    } catch (error) {
      // Rate Limit인 경우에만 대체 모델을 한 번 호출합니다.
      if (error.status !== 429) throw error;
      if (fallbackModel === model) {
        throw new OpenRouterError(503, "대체 모델이 기본 모델과 같아 안전하게 폴백할 수 없어요.", "FALLBACK_UNAVAILABLE");
      }
      result = await requestModel({ apiKey, model: fallbackModel, image, prompt });
      return sendJson(res, 200, { product: result, usedFallback: true });
    }
    return sendJson(res, 200, { product: result, usedFallback: false });
  } catch (error) {
    if (error.status === 429) {
      return sendJson(res, 503, {
        error: "기본 모델과 대체 모델 모두 요청이 몰렸어요. 잠시 후 다시 시도해 주세요.",
        code: "RATE_LIMITED"
      });
    }
    if (error.code === "INVALID_MODEL_RESPONSE") {
      return sendJson(res, 502, {
        error: "AI 응답을 상품 정보로 확인하지 못했어요. 다시 분석해 주세요.",
        code: "INVALID_MODEL_RESPONSE"
      });
    }
    if (error.name === "AbortError") {
      return sendJson(res, 504, { error: "분석 시간이 길어져 요청을 종료했어요. 다시 시도해 주세요.", code: "UPSTREAM_TIMEOUT" });
    }
    if (error.code === "FALLBACK_UNAVAILABLE") {
      return sendJson(res, 503, { error: error.message, code: error.code });
    }
    const status = Number.isInteger(error.status) ? error.status : 0;
    const cause = error.cause || {};
    console.error("OpenRouter 상품 분석 요청에 실패했습니다.", {
      status,
      name: typeof error.name === "string" ? error.name : "Error",
      model: typeof error.model === "string" ? error.model : "",
      causeCode: typeof cause.code === "string" ? cause.code : "",
      message: redactCredential(error.message),
      causeMessage: redactCredential(cause.message)
    });
    if (status === 401 || status === 403) {
      return sendJson(res, 502, {
        error: "OpenRouter API 키가 유효하지 않거나 권한이 없어요. .env.local의 키를 확인해 주세요.",
        code: "OPENROUTER_AUTH_FAILED"
      });
    }
    if (status === 402) {
      return sendJson(res, 502, {
        error: "OpenRouter 계정의 크레딧 또는 결제 설정을 확인해 주세요.",
        code: "OPENROUTER_PAYMENT_REQUIRED"
      });
    }
    if (status === 404) {
      return sendJson(res, 502, {
        error: "요청한 OpenRouter 모델을 사용할 수 없어요. OPENROUTER_MODEL 설정을 확인해 주세요.",
        code: "OPENROUTER_MODEL_UNAVAILABLE"
      });
    }
    if (status === 400) {
      return sendJson(res, 502, {
        error: "OpenRouter가 이미지 분석 요청을 거부했어요. 모델의 이미지 입력 지원 여부를 확인해 주세요.",
        code: "OPENROUTER_REQUEST_REJECTED"
      });
    }
    if (!status && error.name === "TypeError") {
      return sendJson(res, 502, {
        error: "OpenRouter에 연결하지 못했어요. 인터넷 연결이나 방화벽 설정을 확인해 주세요.",
        code: "OPENROUTER_CONNECTION_FAILED"
      });
    }
    return sendJson(res, 502, {
      error: "AI 분석 서버와 통신하지 못했어요. 잠시 후 다시 시도해 주세요.",
      code: "UPSTREAM_ERROR"
    });
  }
};

function validateImage(dataUrl) {
  // 브라우저에서 압축한 허용 형식만 받아 전송 크기를 제한합니다.
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("이미지 데이터가 없거나 허용 크기를 초과했어요.");
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1])) {
    throw new Error("JPEG, PNG, WEBP 이미지 데이터만 분석할 수 있어요.");
  }
  const imageBytes = Buffer.from(match[2], "base64");
  if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
    throw new Error("압축 이미지 크기는 4MB 이하여야 해요.");
  }
  return { dataUrl, mimeType: match[1] };
}

function createPrompt() {
  return [
    "당신은 온라인 쇼핑 상품 이미지에서 옷의 보이는 속성만 정리하는 패션 분석 도우미입니다.",
    "이미지에 보이지 않는 소재, 브랜드, 가격은 추측하지 마세요. 색상은 화면 캡처 기준의 근사값으로 설명하세요.",
    "확신이 낮은 값은 value를 '확인 필요'로 쓰고 confidence를 낮게 주세요. 배열 속성이 불확실하면 빈 배열을 쓰고 notes에 이유를 적으세요.",
    "다음 JSON 형식만 반환하세요. 마크다운이나 JSON 바깥 설명은 쓰지 마세요.",
    JSON.stringify({
      category: { value: "상의 > 셔츠", confidence: 0.8 },
      colors: [{ value: "아이보리", confidence: 0.8 }],
      fit: { value: "레귤러핏", confidence: 0.7 },
      length: { value: "기본", confidence: 0.7 },
      seasonality: [{ value: "봄", confidence: 0.6 }],
      styles: [{ value: "미니멀", confidence: 0.6 }],
      notes: ["이미지에서 확인한 내용 또는 불확실성"]
    })
  ].join("\n");
}

async function requestModel({ apiKey, model, image, prompt }) {
  // 서버에서만 이미지와 프롬프트를 OpenRouter에 전송하고 응답 대기 시간을 제한합니다.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Sa-doel-kka AI Shopping Assistant"
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image.dataUrl } }
          ]
        }]
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = new Error("OpenRouter 요청 실패");
    error.status = response.status;
    error.model = model;
    throw error;
  }

  const payload = await response.json();
  const content = payload && payload.choices && payload.choices[0] &&
    payload.choices[0].message && payload.choices[0].message.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.filter((part) => part && part.type === "text").map((part) => part.text).join("")
      : "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error("모델 응답 JSON 파싱 실패");
    error.code = "INVALID_MODEL_RESPONSE";
    throw error;
  }
  return validateProduct(parsed);
}

function validateProduct(product) {
  // 모델의 자유 형식 응답을 화면에 전달하기 전에 필수 속성과 배열을 검증합니다.
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    throw invalidModelResponse();
  }
  const result = {
    category: validateAttribute(product.category),
    colors: validateAttributeList(product.colors),
    fit: validateAttribute(product.fit),
    length: validateAttribute(product.length),
    seasonality: validateAttributeList(product.seasonality),
    styles: validateAttributeList(product.styles),
    notes: validateNotes(product.notes)
  };
  return result;
}

function validateAttribute(attribute) {
  if (!attribute || typeof attribute !== "object" || Array.isArray(attribute)) {
    throw invalidModelResponse();
  }
  return {
    value: validateText(attribute.value, 60),
    confidence: validateConfidence(attribute.confidence)
  };
}

function validateAttributeList(attributes) {
  if (!Array.isArray(attributes) || attributes.length > 8) throw invalidModelResponse();
  return attributes.map((attribute) => validateAttribute(attribute));
}

function validateNotes(notes) {
  if (notes === undefined) return [];
  if (!Array.isArray(notes) || notes.length > 5) throw invalidModelResponse();
  return notes.map((note) => validateText(note, 180));
}

function validateText(value, maxLength) {
  if (typeof value !== "string") throw invalidModelResponse();
  const text = value.trim();
  if (!text || text.length > maxLength) throw invalidModelResponse();
  return text;
}

function validateConfidence(value) {
  if (value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw invalidModelResponse();
  }
  return value;
}

function invalidModelResponse() {
  const error = new Error("모델 응답이 예상한 상품 속성 구조와 다릅니다.");
  error.code = "INVALID_MODEL_RESPONSE";
  return error;
}

function sendJson(res, status, body) {
  return res.status(status).json(body);
}

function redactCredential(value) {
  if (typeof value !== "string") return "";
  return value.replace(/sk-or-v1-[A-Za-z0-9._-]+/gi, "[REDACTED]").slice(0, 160);
}

class OpenRouterError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
