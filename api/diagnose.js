/* 이 Vercel 함수는 상품과 사용자가 입력한 프로필을 구매 진단으로 변환합니다. */
"use strict";

const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";
const DEFAULT_FALLBACK_MODEL = "nvidia/nemotron-3.5-super-vl:free";
const MAX_REQUEST_BYTES = 24 * 1024;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const EVIDENCE_TYPES = new Set(["product_attribute", "profile_comparison", "unknown_requires_check"]);
const IMPACT_TYPES = new Set(["positive", "negative", "neutral", "uncertain"]);

module.exports = async function diagnose(req, res) {
  // 진단 요청은 JSON POST만 허용하고 OpenRouter 호출 전에 크기와 입력값을 검사합니다.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "POST 요청만 사용할 수 있어요.", code: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, {
      error: "서버에 OpenRouter API 키가 설정되지 않았어요. 운영자에게 설정을 요청해 주세요.",
      code: "API_KEY_MISSING"
    });
  }

  let input;
  try {
    if (!req.body || Buffer.byteLength(JSON.stringify(req.body), "utf8") > MAX_REQUEST_BYTES) {
      throw new InputError("진단 입력이 비어 있거나 허용 크기를 초과했어요.");
    }
    input = validateInput(req.body);
  } catch (error) {
    return sendJson(res, 400, { error: error.message, code: "INVALID_INPUT" });
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallbackModel = process.env.OPENROUTER_TEXT_FALLBACK_MODEL ||
    process.env.OPENROUTER_VISION_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  const prompt = createPrompt(input);

  try {
    let diagnosis;
    try {
      diagnosis = await requestModel(apiKey, model, prompt, input.profile.wardrobeBasics);
    } catch (error) {
      // 429인 경우에만 대체 모델을 정확히 한 번 사용합니다.
      if (error.status !== 429) throw error;
      if (fallbackModel === model) {
        throw new DiagnosisError(503, "대체 모델이 기본 모델과 같아 안전하게 폴백할 수 없어요.", "FALLBACK_UNAVAILABLE");
      }
      diagnosis = await requestModel(apiKey, fallbackModel, prompt, input.profile.wardrobeBasics);
      return sendJson(res, 200, { diagnosis, usedFallback: true });
    }
    return sendJson(res, 200, { diagnosis, usedFallback: false });
  } catch (error) {
    if (error.status === 429) {
      return sendJson(res, 503, {
        error: "기본 모델과 대체 모델 모두 요청이 몰렸어요. 잠시 후 다시 시도해 주세요.",
        code: "RATE_LIMITED"
      });
    }
    if (error.code === "INVALID_MODEL_RESPONSE") {
      return sendJson(res, 502, {
        error: "AI 응답이 예상한 진단 형식과 달라 결과를 표시할 수 없어요. 다시 시도해 주세요.",
        code: "INVALID_MODEL_RESPONSE"
      });
    }
    if (error.name === "AbortError") {
      return sendJson(res, 504, { error: "진단 시간이 길어져 요청을 종료했어요. 다시 시도해 주세요.", code: "UPSTREAM_TIMEOUT" });
    }
    if (error.code === "FALLBACK_UNAVAILABLE") {
      return sendJson(res, 503, { error: error.message, code: error.code });
    }
    console.error("OpenRouter 구매 진단 요청에 실패했습니다.", { status: error.status || 0 });
    return sendJson(res, 502, {
      error: "AI 진단 서버와 통신하지 못했어요. 잠시 후 다시 시도해 주세요.",
      code: "UPSTREAM_ERROR"
    });
  }
};

function validateInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("상품 정보와 프로필 형식이 올바르지 않아요.");
  }
  const product = value.product;
  const profile = value.profile;
  if (!product || !profile || typeof product !== "object" || typeof profile !== "object") {
    throw new InputError("상품 정보와 사용자 프로필을 함께 보내 주세요.");
  }

  const cleanProduct = {
    category: readText(product.category, "상품 카테고리", 60),
    colors: readTextList(product.colors, "상품 색상", 8, 40),
    fit: readText(product.fit, "상품 핏", 50),
    length: readText(product.length, "상품 기장", 50),
    seasonality: readTextList(product.seasonality, "상품 계절감", 8, 40),
    styles: readTextList(product.styles, "상품 스타일", 8, 40)
  };
  const wardrobeBasics = validateWardrobe(profile.wardrobeBasics);
  return {
    product: cleanProduct,
    profile: {
      personalColor: readOptionalText(profile.personalColor, "퍼스널컬러", 60),
      preferredFits: readOptionalList(profile.preferredFits, "선호 핏", 10, 50),
      avoidFits: readOptionalList(profile.avoidFits, "기피 핏", 10, 50),
      preferredStyles: readOptionalList(profile.preferredStyles, "선호 스타일", 10, 50),
      avoidStyles: readOptionalList(profile.avoidStyles, "기피 스타일", 10, 50),
      wardrobeBasics
    }
  };
}

function validateWardrobe(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    throw new InputError("보유 기본템은 한 개 이상, 최대 30개까지 입력해야 해요.");
  }
  const ids = new Set();
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new InputError(`보유 기본템 ${index + 1}번째 항목 형식이 올바르지 않아요.`);
    }
    const id = readText(item.id, `보유 기본템 ${index + 1} ID`, 40);
    if (ids.has(id)) throw new InputError("보유 기본템 ID는 서로 달라야 해요.");
    ids.add(id);
    return {
      id,
      name: readText(item.name, `보유 기본템 ${index + 1} 이름`, 80),
      color: readOptionalText(item.color, "보유 기본템 색상", 40),
      fit: readOptionalText(item.fit, "보유 기본템 핏", 40),
      type: readOptionalText(item.type, "보유 기본템 종류", 40)
    };
  });
}

function readText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new InputError(`${label}을(를) 입력하고 ${maxLength}자 이하로 작성해 주세요.`);
  }
  return value.trim();
}

function readOptionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new InputError(`${label}은(는) ${maxLength}자 이하로 입력해 주세요.`);
  }
  return value.trim();
}

function readTextList(value, label, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new InputError(`${label}은(는) 최대 ${maxItems}개까지 입력할 수 있어요.`);
  }
  return value.map((item) => readText(item, label, maxLength));
}

function readOptionalList(value, label, maxItems, maxLength) {
  if (value === undefined) return [];
  return readTextList(value, label, maxItems, maxLength);
}

function createPrompt(input) {
  return [
    "당신은 옷 구매를 차분하게 검토하는 스타일 조언자입니다.",
    "입력된 상품 속성과 사용자 프로필만 근거로 삼고, 입력되지 않은 취향은 추측하지 마세요.",
    "소재, 품질, 가격, 내구성, 리뷰, 실제 색 재현처럼 입력에 없는 사실은 단정하지 말고 상세 페이지 확인 사항으로 표시하세요.",
    "점수는 개인 프로필에 대한 주관적 적합도이며 구매 결과를 보장하지 않습니다. 총평은 한 문장으로 씁니다.",
    "장점과 단점은 각각 1~4개로 균형 있게 작성하고, 각 항목에는 짧은 제목, 근거, evidenceType을 포함하세요.",
    "evidenceType은 product_attribute, profile_comparison, unknown_requires_check 중 하나만 사용하세요.",
    "코디는 서로 다른 TPO로 정확히 3개 작성하세요. 각 코디에는 product 아이템을 source='product', name='진단 대상 상품'으로 정확히 한 개 포함하고, 입력 wardrobeBasics 중 하나 이상을 포함하세요.",
    "wardrobe 아이템은 입력한 id와 name을 그대로 사용하고, 입력 목록에 없는 옷·신발·가방·액세서리는 절대 추가하지 마세요. styling과 whyItWorks에도 items에 없는 의류나 소품을 언급하지 마세요. item의 source는 product 또는 wardrobe만 사용하세요.",
    "다음 구조의 JSON만 반환하고, 설명이나 마크다운은 JSON 바깥에 쓰지 마세요.",
    JSON.stringify({
      score: 82,
      summary: "선호 핏과 밝은 색감이 입력한 취향에 잘 맞아 활용도가 높아 보여요.",
      scoreRationale: [{ factor: "핏 선호", impact: "positive", reason: "상품의 레귤러핏이 선호 핏과 일치합니다." }],
      pros: [{ title: "선호 핏과 일치", reason: "입력한 선호 핏인 레귤러핏입니다.", evidenceType: "profile_comparison" }],
      cons: [{ title: "실제 색상 확인 필요", reason: "캡처 이미지로 실제 색 재현을 확인할 수 없습니다.", evidenceType: "unknown_requires_check" }],
      outfits: ["출근", "주말 외출", "약속/모임"].map((tpo) => ({
        tpo,
        items: [
          { source: "product", name: "진단 대상 상품" },
          { source: "wardrobe", wardrobeId: "wardrobe-1", name: "진청 스트레이트 데님" }
        ],
        styling: "상품과 입력된 기본템을 함께 매치합니다.",
        whyItWorks: "입력된 상품 속성과 보유 기본템의 조합을 활용합니다."
      })),
      caveats: ["소재와 실제 색상은 상세 페이지에서 확인하세요."]
    }),
    "진단 입력:",
    JSON.stringify(input)
  ].join("\n");
}

async function requestModel(apiKey, model, prompt, wardrobeBasics) {
  // OpenRouter 호출은 서버 안에서만 수행하고 대기 시간을 제한합니다.
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
        messages: [{ role: "user", content: prompt }]
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
    throw invalidModelResponse();
  }
  return validateDiagnosis(parsed, wardrobeBasics);
}

function validateDiagnosis(value, wardrobeBasics) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !Number.isInteger(value.score) || value.score < 0 || value.score > 100) {
    throw invalidModelResponse();
  }
  const summary = readModelText(value.summary, 180);
  if (/[\r\n]/.test(summary)) throw invalidModelResponse();
  const scoreRationale = validateRationale(value.scoreRationale);
  const pros = validateFacts(value.pros);
  const cons = validateFacts(value.cons);
  const outfits = validateOutfits(value.outfits, wardrobeBasics);
  const caveats = value.caveats === undefined ? [] : validateTextList(value.caveats, 5, 180);
  return { score: value.score, summary, scoreRationale, pros, cons, outfits, caveats };
}

function validateRationale(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 5) throw invalidModelResponse();
  return items.map((item) => {
    if (!item || !IMPACT_TYPES.has(item.impact)) throw invalidModelResponse();
    return {
      factor: readModelText(item.factor, 40),
      impact: item.impact,
      reason: readModelText(item.reason, 200)
    };
  });
}

function validateFacts(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 4) throw invalidModelResponse();
  return items.map((item) => {
    if (!item || !EVIDENCE_TYPES.has(item.evidenceType)) throw invalidModelResponse();
    return {
      title: readModelText(item.title, 60),
      reason: readModelText(item.reason, 240),
      evidenceType: item.evidenceType
    };
  });
}

function validateOutfits(items, wardrobeBasics) {
  if (!Array.isArray(items) || items.length !== 3) throw invalidModelResponse();
  const wardrobeById = new Map(wardrobeBasics.map((item) => [item.id, item]));
  const tpos = new Set();
  return items.map((outfit) => {
    if (!outfit || typeof outfit !== "object") throw invalidModelResponse();
    const tpo = readModelText(outfit.tpo, 40);
    if (tpos.has(tpo.toLocaleLowerCase())) throw invalidModelResponse();
    tpos.add(tpo.toLocaleLowerCase());
    if (!Array.isArray(outfit.items) || outfit.items.length < 2 || outfit.items.length > 6) {
      throw invalidModelResponse();
    }
    let productCount = 0;
    let wardrobeCount = 0;
    const itemIds = new Set();
    const cleanItems = outfit.items.map((item) => {
      if (!item || typeof item !== "object") throw invalidModelResponse();
      if (item.source === "product") {
        productCount += 1;
        if (item.name !== "진단 대상 상품") throw invalidModelResponse();
        return { source: "product", name: "진단 대상 상품" };
      }
      if (item.source !== "wardrobe" || typeof item.wardrobeId !== "string") throw invalidModelResponse();
      const knownItem = wardrobeById.get(item.wardrobeId);
      if (!knownItem || item.name !== knownItem.name || itemIds.has(knownItem.id)) throw invalidModelResponse();
      itemIds.add(knownItem.id);
      wardrobeCount += 1;
      return { source: "wardrobe", wardrobeId: knownItem.id, name: knownItem.name };
    });
    if (productCount !== 1 || wardrobeCount < 1) throw invalidModelResponse();
    return {
      tpo,
      items: cleanItems,
      styling: readModelText(outfit.styling, 240),
      whyItWorks: readModelText(outfit.whyItWorks, 240)
    };
  });
}

function validateTextList(items, maxItems, maxLength) {
  if (!Array.isArray(items) || items.length > maxItems) throw invalidModelResponse();
  return items.map((item) => readModelText(item, maxLength));
}

function readModelText(value, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw invalidModelResponse();
  }
  return value.trim();
}

function invalidModelResponse() {
  const error = new Error("모델 응답이 구매 진단 스키마와 일치하지 않습니다.");
  error.code = "INVALID_MODEL_RESPONSE";
  return error;
}

function sendJson(res, status, body) {
  return res.status(status).json(body);
}

class InputError extends Error {}

class DiagnosisError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
