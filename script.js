/* 이 파일은 브라우저의 이미지 선택, 압축, 태그 편집 화면을 담당합니다. */
(() => {
  "use strict";

  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_IMAGE_EDGE = 1024;
  const PROFILE_STORAGE_KEY = "sa-doel-kka_profile_v1";
  const WISHLIST_STORAGE_KEY = "sa-doel-kka_wishlist_v1";
  const STORAGE_SCHEMA_VERSION = 1;
  const MAX_WISHLIST_STORAGE_CHARS = 4 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const GROUPS = [
    { key: "category", label: "카테고리", multiple: false },
    { key: "colors", label: "색상", multiple: true },
    { key: "fit", label: "핏", multiple: false },
    { key: "length", label: "기장", multiple: false },
    { key: "seasonality", label: "계절감", multiple: true },
    { key: "styles", label: "스타일", multiple: true }
  ];
  const PROFILE_CHOICE_GROUPS = [
    { key: "preferredStyles", label: "선호 스타일", elementId: "preferred-style-choices", options: ["미니멀", "클래식", "캐주얼", "페미닌", "스트리트", "빈티지"] },
    { key: "avoidedStyles", label: "기피 스타일", elementId: "avoided-style-choices", options: ["미니멀", "클래식", "캐주얼", "페미닌", "스트리트", "빈티지"] },
    { key: "preferredFits", label: "선호 핏", elementId: "preferred-fit-choices", options: ["슬림핏", "레귤러핏", "세미오버핏", "오버핏"] },
    { key: "avoidedFits", label: "기피 핏", elementId: "avoided-fit-choices", options: ["슬림핏", "레귤러핏", "세미오버핏", "오버핏"] }
  ];
  const WARDROBE_CHOICE_GROUPS = [
    { key: "color", label: "색상", options: ["검정", "흰색", "아이보리", "베이지", "브라운", "회색", "네이비", "파랑", "하늘색", "초록", "빨강", "진청", "연청"] },
    { key: "fit", label: "핏", options: ["슬림", "레귤러", "스트레이트", "세미오버", "오버", "해당 없음"] },
    { key: "length", label: "기장", options: ["크롭", "기본", "롱", "해당 없음"] },
    { key: "type", label: "종류", options: ["상의", "하의", "아우터", "원피스", "신발", "가방", "액세서리"] }
  ];

  const elements = {
    dropZone: document.querySelector("#drop-zone"),
    imageInput: document.querySelector("#image-input"),
    chooseImage: document.querySelector("#choose-image"),
    uploadPrompt: document.querySelector("#upload-prompt"),
    previewWrap: document.querySelector("#preview-wrap"),
    imagePreview: document.querySelector("#image-preview"),
    imageName: document.querySelector("#image-name"),
    removeImage: document.querySelector("#remove-image"),
    fileStatus: document.querySelector("#file-status"),
    analyzeButton: document.querySelector("#analyze-button"),
    analysisSection: document.querySelector("#analysis-section"),
    loadingState: document.querySelector("#loading-state"),
    loadingTitle: document.querySelector("#loading-title"),
    loadingCopy: document.querySelector("#loading-copy"),
    errorState: document.querySelector("#error-state"),
    errorTitle: document.querySelector("#error-title"),
    errorCopy: document.querySelector("#error-copy"),
    retryButton: document.querySelector("#retry-button"),
    resultsPanel: document.querySelector("#results-panel"),
    tagGroups: document.querySelector("#tag-groups"),
    resultNote: document.querySelector("#result-note"),
    copyButton: document.querySelector("#copy-button"),
    reanalyzeButton: document.querySelector("#reanalyze-button"),
    headerStepNumber: document.querySelector("#header-step-number"),
    headerStepName: document.querySelector("#header-step-name"),
    openDiagnosisButton: document.querySelector("#open-diagnosis-button"),
    diagnosisSection: document.querySelector("#diagnosis-section"),
    backToProductButton: document.querySelector("#back-to-product-button"),
    diagnosisForm: document.querySelector("#diagnosis-form"),
    personalColor: document.querySelector("#personal-color"),
    preferredFits: document.querySelector("#preferred-fits"),
    avoidFits: document.querySelector("#avoid-fits"),
    preferredStyles: document.querySelector("#preferred-styles"),
    avoidStyles: document.querySelector("#avoid-styles"),
    wardrobeBasics: document.querySelector("#wardrobe-basics"),
    profileStatus: document.querySelector("#profile-status"),
    diagnoseButton: document.querySelector("#diagnose-button"),
    diagnosisLoading: document.querySelector("#diagnosis-loading"),
    diagnosisLoadingTitle: document.querySelector("#diagnosis-loading-title"),
    diagnosisLoadingCopy: document.querySelector("#diagnosis-loading-copy"),
    diagnosisError: document.querySelector("#diagnosis-error"),
    diagnosisErrorTitle: document.querySelector("#diagnosis-error-title"),
    diagnosisErrorCopy: document.querySelector("#diagnosis-error-copy"),
    retryDiagnosisButton: document.querySelector("#retry-diagnosis-button"),
    diagnosisResults: document.querySelector("#diagnosis-results"),
    diagnosisScore: document.querySelector("#diagnosis-score"),
    scoreLabel: document.querySelector("#score-label"),
    diagnosisSummary: document.querySelector("#diagnosis-summary"),
    scoreRationale: document.querySelector("#score-rationale"),
    prosList: document.querySelector("#pros-list"),
    consList: document.querySelector("#cons-list"),
    outfitList: document.querySelector("#outfit-list"),
    diagnosisCaveats: document.querySelector("#diagnosis-caveats"),
    caveatList: document.querySelector("#caveat-list"),
    diagnosisFallbackNote: document.querySelector("#diagnosis-fallback-note"),
    copyStatus: document.querySelector("#copy-status"),
    saveWishlistButton: document.querySelector("#save-wishlist-button"),
    wishlistSaveStatus: document.querySelector("#wishlist-save-status"),
    workflowView: document.querySelector("#workflow-view"),
    workflowNav: document.querySelector("#workflow-nav"),
    profileNav: document.querySelector("#profile-nav"),
    wishlistNav: document.querySelector("#wishlist-nav"),
    guideNav: document.querySelector("#guide-nav"),
    guidePage: document.querySelector("#guide-page"),
    wishlistCount: document.querySelector("#wishlist-count"),
    profilePage: document.querySelector("#profile-page"),
    wishlistPage: document.querySelector("#wishlist-page"),
    profileStorageAlert: document.querySelector("#profile-storage-alert"),
    profileStorageMessage: document.querySelector("#profile-storage-message"),
    recoverProfileStorage: document.querySelector("#recover-profile-storage"),
    styleProfileForm: document.querySelector("#style-profile-form"),
    savedPersonalColor: document.querySelector("#saved-personal-color"),
    customPersonalColor: document.querySelector("#custom-personal-color"),
    wardrobeChoiceGroups: document.querySelector("#wardrobe-choice-groups"),
    wardrobeNoteInput: document.querySelector("#wardrobe-note-input"),
    wardrobePreview: document.querySelector("#wardrobe-preview"),
    saveWardrobeItem: document.querySelector("#save-wardrobe-item"),
    cancelWardrobeEdit: document.querySelector("#cancel-wardrobe-edit"),
    wardrobeList: document.querySelector("#wardrobe-list"),
    wardrobeEmpty: document.querySelector("#wardrobe-empty"),
    profileSaveStatus: document.querySelector("#profile-save-status"),
    saveProfileButton: document.querySelector("#save-profile-button"),
    wishlistStorageAlert: document.querySelector("#wishlist-storage-alert"),
    wishlistStorageMessage: document.querySelector("#wishlist-storage-message"),
    recoverWishlistStorage: document.querySelector("#recover-wishlist-storage"),
    wishlistTotal: document.querySelector("#wishlist-total"),
    wishlistToolbar: document.querySelector(".wishlist-toolbar"),
    wishlistSearch: document.querySelector("#wishlist-search"),
    wishlistSort: document.querySelector("#wishlist-sort"),
    wishlistStatus: document.querySelector("#wishlist-status"),
    wishlistList: document.querySelector("#wishlist-list"),
    wishlistEmpty: document.querySelector("#wishlist-empty"),
    wishlistNoResults: document.querySelector("#wishlist-no-results"),
    goToWorkflowButton: document.querySelector("#go-to-workflow-button")
  };

  let selectedFile = null;
  let previewUrl = null;
  let product = null;
  let analysisNotes = [];
  let confidenceByGroup = {};
  let usedFallback = false;
  let busy = false;
  let diagnosisBusy = false;
  let latestDiagnosis = null;
  let latestDiagnosisProfile = null;
  let profileRecord = createDefaultProfileRecord();
  let profileDraft = createDefaultProfile();
  let profileDirty = false;
  let wishlistEntries = [];
  let profileStorageBlocked = false;
  let wishlistStorageBlocked = false;
  let storageUnavailable = false;
  let editingWardrobeId = null;
  let wardrobeBuilder = { color: "", fit: "", length: "", type: "", note: "" };

  // 파일 선택 버튼은 숨겨진 입력을 열어 키보드와 포인터 모두로 사용할 수 있게 합니다.
  elements.chooseImage.addEventListener("click", (event) => {
    event.stopPropagation();
    elements.imageInput.click();
  });
  elements.imageInput.addEventListener("change", () => {
    if (elements.imageInput.files && elements.imageInput.files[0]) setImage(elements.imageInput.files[0]);
    elements.imageInput.value = "";
  });
  elements.removeImage.addEventListener("click", clearImage);

  // 드롭 동작은 브라우저가 파일을 새 페이지로 여는 기본 동작을 막습니다.
  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("is-dragging");
    });
  });
  elements.dropZone.addEventListener("drop", (event) => {
    const files = event.dataTransfer && event.dataTransfer.files;
    if (files && files[0]) setImage(files[0]);
  });

  elements.analyzeButton.addEventListener("click", analyzeImage);
  elements.retryButton.addEventListener("click", analyzeImage);
  elements.reanalyzeButton.addEventListener("click", analyzeImage);
  elements.copyButton.addEventListener("click", copyProductData);
  elements.openDiagnosisButton.addEventListener("click", openDiagnosis);
  elements.backToProductButton.addEventListener("click", () => {
    setActiveStep(false);
    elements.analysisSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.diagnosisForm.addEventListener("input", handleProfileChange);
  elements.diagnosisForm.addEventListener("submit", submitDiagnosis);
  elements.retryDiagnosisButton.addEventListener("click", submitDiagnosis);
  elements.saveWishlistButton.addEventListener("click", saveWishlistEntry);
  elements.workflowNav.addEventListener("click", () => showAppView("workflow"));
  elements.profileNav.addEventListener("click", () => showAppView("profile"));
  elements.wishlistNav.addEventListener("click", () => showAppView("wishlist"));
  elements.guideNav.addEventListener("click", () => showAppView("guide"));
  // 가이드 안의 이동 버튼은 data-guide-go 값에 적힌 화면으로 이동합니다.
  elements.guidePage.addEventListener("click", (event) => {
    const button = event.target.closest("[data-guide-go]");
    if (!button) return;
    const target = button.dataset.guideGo;
    if (["workflow", "profile", "wishlist"].includes(target)) showAppView(target);
  });
  elements.goToWorkflowButton.addEventListener("click", () => showAppView("workflow"));
  elements.savedPersonalColor.addEventListener("change", handlePersonalColorChange);
  elements.customPersonalColor.addEventListener("input", handleProfilePageEdit);
  elements.styleProfileForm.addEventListener("submit", saveProfile);
  elements.styleProfileForm.addEventListener("input", handleProfilePageEdit);
  elements.wardrobeChoiceGroups.addEventListener("click", handleWardrobeChoiceClick);
  elements.wardrobeList.addEventListener("click", handleWardrobeListAction);
  elements.wardrobeNoteInput.addEventListener("input", updateWardrobePreview);
  elements.saveWardrobeItem.addEventListener("click", saveWardrobeItem);
  elements.cancelWardrobeEdit.addEventListener("click", resetWardrobeBuilder);
  elements.wishlistSearch.addEventListener("input", renderWishlist);
  elements.wishlistSort.addEventListener("change", renderWishlist);
  elements.recoverProfileStorage.addEventListener("click", () => recoverStorage(PROFILE_STORAGE_KEY));
  elements.recoverWishlistStorage.addEventListener("click", () => recoverStorage(WISHLIST_STORAGE_KEY));
  elements.wishlistList.addEventListener("click", handleWishlistAction);

  PROFILE_CHOICE_GROUPS.forEach((group) => {
    const container = document.getElementById(group.elementId);
    container.addEventListener("click", (event) => handlePreferenceChoiceClick(event, group));
  });
  [
    { key: "preferredStyles", input: "#add-preferred-style-input", button: "#add-preferred-style" },
    { key: "avoidedStyles", input: "#add-avoided-style-input", button: "#add-avoided-style" },
    { key: "preferredFits", input: "#add-preferred-fit-input", button: "#add-preferred-fit" },
    { key: "avoidedFits", input: "#add-avoided-fit-input", button: "#add-avoided-fit" }
  ].forEach((config) => {
    document.querySelector(config.button).addEventListener("click", () => addPreference(config.key, document.querySelector(config.input)));
    document.querySelector(config.input).addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addPreference(config.key, document.querySelector(config.input));
      }
    });
  });

  initializeStepThree();

  // 선택된 파일을 먼저 검사해 잘못된 입력이 API 요청으로 이어지지 않게 합니다.
  function setImage(file) {
    if (busy || diagnosisBusy) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      showFileError("JPG, PNG, WEBP 이미지 파일만 사용할 수 있어요.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      showFileError("이미지 크기는 0보다 크고 15MB 이하여야 해요.");
      return;
    }

    releasePreviewUrl();
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
    elements.imagePreview.src = previewUrl;
    elements.imageName.textContent = file.name;
    elements.uploadPrompt.hidden = true;
    elements.previewWrap.hidden = false;
    elements.analyzeButton.disabled = false;
    elements.fileStatus.textContent = "이미지를 확인했어요. 분석을 시작할 수 있어요.";
    elements.fileStatus.removeAttribute("role");
    elements.analysisSection.hidden = true;
    elements.copyStatus.textContent = "";
    product = null;
    elements.diagnosisSection.hidden = true;
    invalidateDiagnosis();
    setActiveStep(false);
  }

  // 이미지를 바꾸거나 제거하면 이전 상품 분석이 새 이미지에 연결되지 않도록 초기화합니다.
  function clearImage() {
    if (busy || diagnosisBusy) return;
    selectedFile = null;
    releasePreviewUrl();
    elements.imagePreview.removeAttribute("src");
    elements.imageName.textContent = "";
    elements.previewWrap.hidden = true;
    elements.uploadPrompt.hidden = false;
    elements.analyzeButton.disabled = true;
    elements.fileStatus.textContent = "상품 캡처 이미지를 선택해 주세요.";
    elements.analysisSection.hidden = true;
    elements.imageInput.value = "";
    product = null;
    elements.diagnosisSection.hidden = true;
    invalidateDiagnosis();
    setActiveStep(false);
  }

  function releasePreviewUrl() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  function showFileError(message) {
    elements.fileStatus.textContent = message;
    elements.fileStatus.setAttribute("role", "alert");
  }

  // Canvas에서 긴 변을 1024px 이하로 줄이고, 투명 PNG는 투명도를 유지합니다.
  async function compressImage(file) {
    const source = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height));
      const width = Math.max(1, Math.round(source.width * ratio));
      const height = Math.max(1, Math.round(source.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("이 브라우저에서 이미지 압축 기능을 사용할 수 없어요.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, width, height);

      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("이미지 압축 결과를 만들지 못했어요."));
        }, outputType, 0.82);
      });
      if (blob.size > 4 * 1024 * 1024) {
        throw new Error("압축한 이미지가 너무 커요. 더 작은 캡처 이미지로 다시 시도해 주세요.");
      }

      return {
        dataUrl: await blobToDataUrl(blob),
        width,
        height
      };
    } finally {
      source.close();
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("압축한 이미지를 읽지 못했어요."));
      reader.readAsDataURL(blob);
    });
  }

  // 서버에는 압축 이미지 하나만 보내고, 모델 결과가 유효한 경우에만 편집 화면에 표시합니다.
  async function analyzeImage() {
    if (!selectedFile || busy || diagnosisBusy) return;
    busy = true;
    setBusy(true);
    elements.diagnosisSection.hidden = true;
    invalidateDiagnosis();
    setActiveStep(false);
    showLoading("이미지 속 옷을 살펴보는 중", "색상과 핏, 분위기를 정리하고 있어요.");
    elements.errorState.hidden = true;
    elements.resultsPanel.hidden = true;
    elements.analysisSection.hidden = false;
    elements.analysisSection.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const compressed = await compressImage(selectedFile);
      elements.loadingCopy.textContent = `${compressed.width} × ${compressed.height}px로 줄인 이미지를 분석하고 있어요.`;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: compressed.dataUrl })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(payload && payload.error ? payload.error : "분석 서버와 통신하지 못했어요.");
        error.code = payload && payload.code;
        throw error;
      }

      product = normalizeProduct(payload.product);
      analysisNotes = Array.isArray(payload.product.notes) ? payload.product.notes : [];
      confidenceByGroup = getConfidence(payload.product);
      usedFallback = payload.usedFallback === true;
      invalidateDiagnosis();
      setActiveStep(false);
      renderProduct();
      elements.resultsPanel.hidden = false;
      elements.loadingState.hidden = true;
      elements.errorState.hidden = true;
      elements.fileStatus.textContent = "분석이 끝났어요. 결과 태그를 확인해 주세요.";
    } catch (error) {
      elements.loadingState.hidden = true;
      elements.errorState.hidden = false;
      elements.errorTitle.textContent = error.code === "RATE_LIMITED"
        ? "요청이 잠시 몰렸어요"
        : "분석을 완료하지 못했어요";
      elements.errorCopy.textContent = error.message || "잠시 후 다시 시도해 주세요.";
      elements.fileStatus.textContent = "분석에 실패했어요. 이미지와 연결 상태를 확인해 주세요.";
    } finally {
      busy = false;
      setBusy(false);
    }
  }

  function showLoading(title, copy) {
    elements.loadingTitle.textContent = title;
    elements.loadingCopy.textContent = copy;
    elements.loadingState.hidden = false;
  }

  function setBusy(isBusy) {
    elements.analyzeButton.disabled = isBusy || !selectedFile;
    elements.retryButton.disabled = isBusy;
    elements.reanalyzeButton.disabled = isBusy;
    elements.chooseImage.disabled = isBusy;
    elements.removeImage.disabled = isBusy;
    elements.imageInput.disabled = isBusy;
    elements.analyzeButton.querySelector(".button-label").textContent = isBusy ? "분석 중이에요" : "옷 특징 분석하기";
  }

  // 서버 응답에서 다음 단계에 필요한 값만 골라 편집 가능한 형태로 정규화합니다.
  function normalizeProduct(value) {
    if (!value || typeof value !== "object") throw new Error("분석 결과 형식이 올바르지 않아요. 다시 시도해 주세요.");
    const normalized = {
      category: readValue(value.category),
      colors: readList(value.colors),
      fit: readValue(value.fit),
      length: readValue(value.length),
      seasonality: readList(value.seasonality),
      styles: readList(value.styles)
    };
    if (!normalized.category || !normalized.fit || !normalized.length) {
      throw new Error("필수 상품 정보가 빠져 있어요. 다시 분석해 주세요.");
    }
    return normalized;
  }

  function getConfidence(value) {
    const confidence = {};
    GROUPS.forEach((group) => {
      const source = value[group.key];
      const values = Array.isArray(source) ? source : [source];
      const scores = values
        .map((item) => item && typeof item === "object" ? item.confidence : null)
        .filter((score) => typeof score === "number" && Number.isFinite(score));
      if (scores.length) confidence[group.key] = Math.min(...scores);
    });
    return confidence;
  }

  function readValue(value) {
    if (typeof value === "string") return value.trim();
    if (value && typeof value.value === "string") return value.value.trim();
    return "";
  }

  function readList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => readValue(item)).filter(Boolean);
  }

  // DOM 텍스트 API만 사용해 모델 문자열이 HTML로 실행되는 일을 막습니다.
  function renderProduct() {
    elements.tagGroups.replaceChildren();
    GROUPS.forEach((group) => {
      const card = document.createElement("section");
      card.className = "tag-group";
      const header = document.createElement("div");
      header.className = "tag-group-header";
      const title = document.createElement("h3");
      title.textContent = group.label;
      header.append(title);
      if (confidenceByGroup[group.key] !== undefined && confidenceByGroup[group.key] < 0.6) {
        const confidenceLabel = document.createElement("span");
        confidenceLabel.className = "confidence-label";
        confidenceLabel.textContent = "확인 권장";
        header.append(confidenceLabel);
      }
      const list = document.createElement("div");
      list.className = "tag-list";
      list.setAttribute("aria-label", `${group.label} 태그`);
      card.append(header, list);
      elements.tagGroups.append(card);
      renderGroup(group, list);
    });
    const messages = [];
    if (usedFallback) messages.push("요청이 많아 대체 모델로 분석했어요.");
    if (analysisNotes.length) messages.push(...analysisNotes);
    else messages.push("이미지에서 확인할 수 있는 정보만 정리했어요. 실제 색상과 상세 정보는 상품 페이지에서 확인해 주세요.");
    elements.resultNote.textContent = messages.join(" · ");
  }

  function getGroupValues(group) {
    const current = product[group.key];
    if (group.multiple) return current;
    return current ? [current] : [];
  }

  function renderGroup(group, list) {
    list.replaceChildren();
    const values = getGroupValues(group);
    values.forEach((value, index) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      const text = document.createElement("span");
      text.className = "tag-value";
      text.textContent = value;
      const edit = document.createElement("button");
      edit.className = "tag-action";
      edit.type = "button";
      edit.textContent = "수정";
      edit.setAttribute("aria-label", `${group.label} ${value} 수정`);
      edit.addEventListener("click", () => showTagEditor(group, list, index, value));
      const remove = document.createElement("button");
      remove.className = "tag-action";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${group.label} ${value} 삭제`);
      remove.addEventListener("click", () => removeTag(group, list, index));
      chip.append(text, edit, remove);
      list.append(chip);
    });

    const add = document.createElement("button");
    add.className = "small-action";
    add.type = "button";
    add.textContent = "+ 추가";
    add.setAttribute("aria-label", `${group.label} 태그 추가`);
    add.addEventListener("click", () => showTagAdder(group, list));
    list.append(add);
  }

  function showTagEditor(group, list, index, oldValue) {
    const form = document.createElement("form");
    form.className = "tag-edit-form";
    const input = document.createElement("input");
    input.className = "tag-input tag-edit-input";
    input.value = oldValue;
    input.maxLength = 40;
    input.setAttribute("aria-label", `${group.label} 태그 수정`);
    const save = document.createElement("button");
    save.className = "small-action";
    save.type = "submit";
    save.textContent = "저장";
    form.append(input, save);
    replaceTagListWithForm(group, list, form);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const nextValue = input.value.trim();
      if (!nextValue) {
        input.focus();
        return;
      }
      delete confidenceByGroup[group.key];
      if (group.multiple) product[group.key][index] = nextValue;
      else product[group.key] = nextValue;
      invalidateDiagnosis();
      renderGroup(group, list);
    });
    input.focus();
    input.select();
  }

  function showTagAdder(group, list) {
    const form = document.createElement("form");
    form.className = "tag-add-form";
    const input = document.createElement("input");
    input.className = "tag-input";
    input.maxLength = 40;
    input.placeholder = "태그 입력";
    input.setAttribute("aria-label", `${group.label} 새 태그`);
    const add = document.createElement("button");
    add.className = "small-action";
    add.type = "submit";
    add.textContent = "추가";
    form.append(input, add);
    replaceTagListWithForm(group, list, form);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      delete confidenceByGroup[group.key];
      if (group.multiple) {
        if (!product[group.key].includes(value)) product[group.key].push(value);
      } else {
        product[group.key] = value;
      }
      invalidateDiagnosis();
      renderGroup(group, list);
    });
    input.focus();
  }

  function replaceTagListWithForm(group, list, form) {
    const values = getGroupValues(group);
    list.replaceChildren();
    values.forEach((value, index) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      const text = document.createElement("span");
      text.className = "tag-value";
      text.textContent = value;
      chip.append(text);
      list.append(chip);
    });
    list.append(form);
  }

  function removeTag(group, list, index) {
    delete confidenceByGroup[group.key];
    if (group.multiple) product[group.key].splice(index, 1);
    else product[group.key] = "";
    invalidateDiagnosis();
    renderGroup(group, list);
  }

  async function copyProductData() {
    if (!product) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(product, null, 2));
      elements.copyStatus.textContent = "수정한 상품 정보 JSON을 복사했어요.";
    } catch {
      elements.copyStatus.textContent = "복사하지 못했어요. 브라우저 권한을 확인해 주세요.";
    }
  }

  // 진단 화면을 열 때는 1단계에서 사용자가 수정한 현재 상품 정보를 그대로 사용합니다.
  function openDiagnosis() {
    if (!product) return;
    elements.diagnosisSection.hidden = false;
    setActiveStep(true);
    updateProfileAvailability();
    elements.diagnosisSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setActiveStep(isDiagnosis) {
    elements.headerStepNumber.textContent = isDiagnosis ? "STEP 02" : "STEP 01";
    elements.headerStepName.textContent = isDiagnosis ? "구매 진단" : "상품 분석";
  }

  function handleProfileChange() {
    if (diagnosisBusy) return;
    invalidateDiagnosis();
    updateProfileAvailability();
  }

  function updateProfileAvailability() {
    if (diagnosisBusy) return;
    try {
      const wardrobe = parseWardrobeItems();
      elements.diagnoseButton.disabled = !product || wardrobe.length === 0;
      elements.profileStatus.textContent = wardrobe.length
        ? `${wardrobe.length}개의 보유 기본템으로 코디를 만들 준비가 됐어요.`
        : "코디를 만들려면 보유 기본템을 한 개 이상 적어 주세요.";
      elements.profileStatus.removeAttribute("role");
    } catch (error) {
      elements.diagnoseButton.disabled = true;
      elements.profileStatus.textContent = error.message;
      elements.profileStatus.setAttribute("role", "alert");
    }
  }

  function parseCommaList(input, label) {
    const values = input.value.split(",").map((value) => value.trim()).filter(Boolean);
    if (values.length > 10 || values.some((value) => value.length > 50)) {
      throw new Error(`${label}은 50자 이하, 최대 10개까지 입력할 수 있어요.`);
    }
    return [...new Set(values)];
  }

  function parseWardrobeItems() {
    const lines = elements.wardrobeBasics.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 30) throw new Error("보유 기본템은 최대 30개까지 입력할 수 있어요.");
    return lines.map((line, index) => {
      const fields = line.split("|").map((field) => field.trim());
      const [name, color = "", fit = "", type = ""] = fields;
      if (!name || name.length > 80 || color.length > 40 || fit.length > 40 || type.length > 40 || fields.length > 4) {
        throw new Error(`보유 기본템 ${index + 1}번째 줄을 확인해 주세요. 각 항목은 제한 길이와 형식을 지켜야 해요.`);
      }
      return { id: `wardrobe-${index + 1}`, name, color, fit, type };
    });
  }

  function buildDiagnosisRequest() {
    if (!product) throw new Error("먼저 상품 이미지를 분석해 주세요.");
    const wardrobeBasics = parseWardrobeItems();
    if (!wardrobeBasics.length) throw new Error("보유 기본템을 한 개 이상 입력해 주세요.");
    const personalColor = elements.personalColor.value.trim();
    if (personalColor.length > 60) throw new Error("퍼스널컬러는 60자 이하로 입력해 주세요.");

    return {
      product: JSON.parse(JSON.stringify(product)),
      profile: {
        personalColor,
        preferredFits: parseCommaList(elements.preferredFits, "선호 핏"),
        avoidFits: parseCommaList(elements.avoidFits, "기피 핏"),
        preferredStyles: parseCommaList(elements.preferredStyles, "선호 스타일"),
        avoidStyles: parseCommaList(elements.avoidStyles, "기피 스타일"),
        wardrobeBasics
      }
    };
  }

  // 최신 입력만 진단할 수 있도록 상품이나 프로필이 바뀌면 이전 결과를 숨깁니다.
  function invalidateDiagnosis() {
    latestDiagnosis = null;
    latestDiagnosisProfile = null;
    elements.diagnosisResults.hidden = true;
    elements.diagnosisError.hidden = true;
    elements.diagnosisLoading.hidden = true;
    elements.diagnosisFallbackNote.hidden = true;
    elements.saveWishlistButton.disabled = true;
    elements.wishlistSaveStatus.textContent = "";
  }

  async function submitDiagnosis(event) {
    if (event) event.preventDefault();
    if (diagnosisBusy) return;

    let requestBody;
    try {
      requestBody = buildDiagnosisRequest();
    } catch (error) {
      elements.profileStatus.textContent = error.message;
      elements.profileStatus.setAttribute("role", "alert");
      return;
    }

    diagnosisBusy = true;
    setDiagnosisBusy(true);
    invalidateDiagnosis();
    elements.diagnosisSection.hidden = false;
    elements.diagnosisLoading.hidden = false;
    elements.diagnosisLoadingTitle.textContent = "내 스타일과 비교하는 중";
    elements.diagnosisLoadingCopy.textContent = "상품 특징과 보유 기본템만으로 코디를 구성하고 있어요.";
    elements.diagnosisSection.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(payload && payload.error ? payload.error : "진단 서버와 통신하지 못했어요.");
        error.code = payload && payload.code;
        throw error;
      }

      const diagnosis = validateDiagnosis(payload.diagnosis, requestBody.profile.wardrobeBasics);
      renderDiagnosis(diagnosis, payload.usedFallback === true);
      latestDiagnosis = {
        diagnosis: JSON.parse(JSON.stringify(diagnosis)),
        usedFallback: payload.usedFallback === true
      };
      latestDiagnosisProfile = JSON.parse(JSON.stringify(requestBody.profile));
      elements.saveWishlistButton.disabled = false;
      elements.diagnosisLoading.hidden = true;
      elements.diagnosisError.hidden = true;
      elements.diagnosisResults.hidden = false;
      elements.profileStatus.textContent = "진단이 끝났어요. 입력하신 정보 기준의 AI 의견을 확인해 주세요.";
      elements.profileStatus.removeAttribute("role");
    } catch (error) {
      elements.diagnosisLoading.hidden = true;
      elements.diagnosisError.hidden = false;
      elements.diagnosisErrorTitle.textContent = error.code === "RATE_LIMITED"
        ? "요청이 잠시 몰렸어요"
        : "진단을 완료하지 못했어요";
      elements.diagnosisErrorCopy.textContent = error.message || "잠시 후 다시 시도해 주세요.";
    } finally {
      diagnosisBusy = false;
      setDiagnosisBusy(false);
    }
  }

  function setDiagnosisBusy(isBusy) {
    elements.diagnosisForm.querySelectorAll("input, textarea").forEach((input) => {
      input.disabled = isBusy;
    });
    elements.chooseImage.disabled = isBusy || busy;
    elements.removeImage.disabled = isBusy || busy;
    elements.imageInput.disabled = isBusy || busy;
    elements.analyzeButton.disabled = isBusy || busy || !selectedFile;
    elements.reanalyzeButton.disabled = isBusy || busy;
    elements.openDiagnosisButton.disabled = isBusy;
    elements.tagGroups.querySelectorAll("button, input").forEach((control) => {
      control.disabled = isBusy;
    });
    elements.diagnoseButton.disabled = isBusy || !elements.wardrobeBasics.value.trim() || !product;
    elements.retryDiagnosisButton.disabled = isBusy;
  }

  function validateDiagnosis(value, wardrobeBasics) {
    if (!value || typeof value !== "object" || !Number.isInteger(value.score) || value.score < 0 || value.score > 100) {
      throw new Error("진단 결과의 점수를 확인할 수 없어요. 다시 시도해 주세요.");
    }
    if (typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 180 || /[\r\n]/.test(value.summary)) {
      throw new Error("진단 결과의 총평 형식이 올바르지 않아요. 다시 시도해 주세요.");
    }
    if (!Array.isArray(value.scoreRationale) || value.scoreRationale.length < 1 || value.scoreRationale.length > 5) {
      throw new Error("점수 근거가 올바르지 않아 진단 결과를 표시할 수 없어요.");
    }
    validateFactList(value.pros);
    validateFactList(value.cons);
    if (!Array.isArray(value.outfits) || value.outfits.length !== 3) {
      throw new Error("코디 결과가 정확히 3가지가 아니어서 표시할 수 없어요.");
    }

    const wardrobeById = new Map(wardrobeBasics.map((item) => [item.id, item]));
    const tpos = new Set();
    value.outfits.forEach((outfit) => {
      if (!outfit || typeof outfit.tpo !== "string" || !outfit.tpo.trim() || tpos.has(outfit.tpo.trim())) {
        throw new Error("TPO별 코디 구성이 올바르지 않아요. 다시 시도해 주세요.");
      }
      tpos.add(outfit.tpo.trim());
      if (!Array.isArray(outfit.items) || outfit.items.length < 2 || outfit.items.length > 6) {
        throw new Error("코디 아이템 구성이 올바르지 않아요. 다시 시도해 주세요.");
      }
      let productCount = 0;
      let wardrobeCount = 0;
      outfit.items.forEach((item) => {
        if (item.source === "product") {
          productCount += 1;
          if (item.name !== "진단 대상 상품") throw new Error("코디에서 진단 상품을 식별하지 못했어요.");
        } else if (item.source === "wardrobe") {
          const knownItem = wardrobeById.get(item.wardrobeId);
          if (!knownItem || knownItem.name !== item.name) {
            throw new Error("입력하지 않은 기본템이 코디에 포함되어 결과를 표시할 수 없어요.");
          }
          wardrobeCount += 1;
        } else {
          throw new Error("코디에 허용되지 않은 아이템이 있어 결과를 표시할 수 없어요.");
        }
      });
      if (productCount !== 1 || wardrobeCount < 1) {
        throw new Error("각 코디는 진단 상품과 보유 기본템을 포함해야 해요.");
      }
      ["styling", "whyItWorks"].forEach((key) => {
        if (typeof outfit[key] !== "string" || !outfit[key].trim() || outfit[key].length > 240) {
          throw new Error("코디 설명이 올바르지 않아 결과를 표시할 수 없어요.");
        }
      });
    });

    value.scoreRationale.forEach((item) => {
      if (!item || typeof item.factor !== "string" || typeof item.reason !== "string" ||
          !["positive", "negative", "neutral", "uncertain"].includes(item.impact)) {
        throw new Error("점수 근거 형식이 올바르지 않아요.");
      }
    });
    if (value.caveats !== undefined && (!Array.isArray(value.caveats) || value.caveats.length > 5 ||
        value.caveats.some((item) => typeof item !== "string" || item.length > 180))) {
      throw new Error("확인 안내 형식이 올바르지 않아요.");
    }
    return value;
  }

  function validateFactList(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 4) {
      throw new Error("장점 또는 단점 항목 수가 올바르지 않아요.");
    }
    items.forEach((item) => {
      if (!item || typeof item.title !== "string" || !item.title.trim() ||
          typeof item.reason !== "string" || !item.reason.trim() ||
          !["product_attribute", "profile_comparison", "unknown_requires_check"].includes(item.evidenceType)) {
        throw new Error("장점 또는 단점의 근거 형식이 올바르지 않아요.");
      }
    });
  }

  // 모든 모델 문자열은 textContent로 출력해 응답이 HTML로 실행되지 않게 합니다.
  function renderDiagnosis(result, usedFallbackResult) {
    elements.diagnosisScore.textContent = String(result.score);
    elements.diagnosisSummary.textContent = result.summary;
    elements.scoreLabel.textContent = result.score >= 80 ? "추천" : result.score >= 60 ? "고민해 볼 만해요" : "신중하게 고민해요";
    elements.scoreLabel.dataset.tier = result.score >= 80 ? "recommend" : result.score >= 60 ? "consider" : "avoid";

    elements.scoreRationale.replaceChildren();
    result.scoreRationale.forEach((item) => {
      const row = document.createElement("li");
      const factor = document.createElement("strong");
      factor.textContent = `${item.factor} · `;
      const impact = document.createElement("span");
      impact.className = `impact-${item.impact}`;
      impact.textContent = `${impactLabel(item.impact)} `;
      const reason = document.createElement("span");
      reason.textContent = item.reason;
      row.append(factor, impact, reason);
      elements.scoreRationale.append(row);
    });

    renderFactCards(elements.prosList, result.pros);
    renderFactCards(elements.consList, result.cons);
    renderOutfits(result.outfits);
    elements.caveatList.replaceChildren();
    (result.caveats || []).forEach((caveat) => {
      const item = document.createElement("li");
      item.textContent = caveat;
      elements.caveatList.append(item);
    });
    elements.diagnosisCaveats.hidden = !result.caveats || result.caveats.length === 0;
    elements.diagnosisFallbackNote.hidden = !usedFallbackResult;
  }

  function impactLabel(impact) {
    return {
      positive: "긍정",
      negative: "주의",
      neutral: "참고",
      uncertain: "불확실"
    }[impact];
  }

  function renderFactCards(container, facts) {
    container.replaceChildren();
    facts.forEach((fact) => {
      const card = document.createElement("article");
      card.className = "fact-item";
      const title = document.createElement("h4");
      title.textContent = fact.title;
      const reason = document.createElement("p");
      reason.textContent = fact.reason;
      const evidence = document.createElement("span");
      evidence.className = "evidence-label";
      evidence.textContent = evidenceLabel(fact.evidenceType);
      card.append(title, reason, evidence);
      container.append(card);
    });
  }

  function evidenceLabel(type) {
    return {
      product_attribute: "상품 정보 기준",
      profile_comparison: "내 프로필 비교",
      unknown_requires_check: "상세 페이지에서 확인 필요"
    }[type];
  }

  function renderOutfits(outfits) {
    elements.outfitList.replaceChildren();
    outfits.forEach((outfit) => {
      const card = document.createElement("article");
      card.className = "outfit-card";
      const tpo = document.createElement("span");
      tpo.className = "outfit-tpo";
      tpo.textContent = outfit.tpo;
      const items = document.createElement("div");
      items.className = "outfit-items";
      outfit.items.forEach((item) => {
        const chip = document.createElement("span");
        chip.className = "outfit-item";
        chip.dataset.source = item.source;
        chip.textContent = item.source === "product" ? `진단 상품 · ${item.name}` : item.name;
        items.append(chip);
      });
      const styling = document.createElement("p");
      styling.textContent = outfit.styling;
      const why = document.createElement("p");
      const whyLabel = document.createElement("strong");
      whyLabel.textContent = "잘 맞는 이유: ";
      const whyText = document.createTextNode(outfit.whyItWorks);
      why.append(whyLabel, whyText);
      card.append(tpo, items, styling, why);
      elements.outfitList.append(card);
    });
  }

  // 저장 형식의 기본값과 읽기 검증을 한 곳에서 관리합니다.
  function createDefaultProfile() {
    return {
      personalColor: "unknown",
      customPersonalColor: "",
      preferredStyles: [],
      avoidedStyles: [],
      preferredFits: [],
      avoidedFits: [],
      wardrobeBasics: []
    };
  }

  function createDefaultProfileRecord() {
    return { schemaVersion: STORAGE_SCHEMA_VERSION, profile: createDefaultProfile() };
  }

  function createDefaultWishlistRecord() {
    return { schemaVersion: STORAGE_SCHEMA_VERSION, items: [] };
  }

  function initializeStepThree() {
    const storedProfile = readStorage(PROFILE_STORAGE_KEY, isValidProfileRecord);
    if (storedProfile.ok && storedProfile.value) {
      profileRecord = storedProfile.value;
      profileDraft = JSON.parse(JSON.stringify(profileRecord.profile));
    }

    const storedWishlist = readStorage(WISHLIST_STORAGE_KEY, isValidWishlistRecord);
    if (storedWishlist.ok && storedWishlist.value) wishlistEntries = storedWishlist.value.items;

    renderProfilePage();
    renderWishlist();
    updateWishlistCount();
    applyProfileToDiagnosis();
    updateProfileAvailability();
  }

  function readStorage(key, isValid) {
    let raw;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      setStorageAlert(key, "브라우저 저장소에 접근할 수 없어요. 브라우저의 사이트 데이터 설정을 확인해 주세요.", false);
      return { ok: false, value: null };
    }
    if (raw === null) return { ok: true, value: null };

    try {
      const value = JSON.parse(raw);
      if (!isValid(value)) throw new Error("저장 형식 또는 버전이 올바르지 않습니다.");
      return { ok: true, value };
    } catch {
      setStorageAlert(key, "저장된 데이터가 손상되었거나 지원하지 않는 버전이에요. 확인 후 초기화하면 새로 시작할 수 있어요.", true);
      if (key === PROFILE_STORAGE_KEY) profileStorageBlocked = true;
      else wishlistStorageBlocked = true;
      return { ok: false, value: null };
    }
  }

  function isValidProfileRecord(value) {
    if (!value || value.schemaVersion !== STORAGE_SCHEMA_VERSION || !value.profile) return false;
    const profile = value.profile;
    const stringFields = ["personalColor", "customPersonalColor"];
    if (stringFields.some((key) => typeof profile[key] !== "string" || profile[key].length > 60)) return false;
    const arrayFields = ["preferredStyles", "avoidedStyles", "preferredFits", "avoidedFits"];
    if (arrayFields.some((key) => !Array.isArray(profile[key]) || profile[key].length > 10 ||
      profile[key].some((item) => typeof item !== "string" || !item.trim() || item.length > 40))) return false;
    if (!Array.isArray(profile.wardrobeBasics) || profile.wardrobeBasics.length > 30) return false;
    return profile.wardrobeBasics.every((item) => item && typeof item.id === "string" &&
      typeof item.name === "string" && item.name.length <= 80 &&
      ["color", "fit", "length", "type", "note"].every((key) => typeof item[key] === "string" && item[key].length <= 80));
  }

  function isValidWishlistRecord(value) {
    if (!value || value.schemaVersion !== STORAGE_SCHEMA_VERSION || !Array.isArray(value.items) || value.items.length > 500) return false;
    return value.items.every((item) => item && typeof item.id === "string" &&
      typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt)) &&
      item.product && typeof item.product === "object" &&
      ["category", "fit", "length"].every((key) => typeof item.product[key] === "string") &&
      ["colors", "seasonality", "styles"].every((key) => Array.isArray(item.product[key]) &&
        item.product[key].every((text) => typeof text === "string")) &&
      item.diagnosis && Number.isInteger(item.diagnosis.score) &&
      item.diagnosis.score >= 0 && item.diagnosis.score <= 100 &&
      typeof item.diagnosis.summary === "string" &&
      Array.isArray(item.diagnosis.pros) && Array.isArray(item.diagnosis.cons) &&
      [...item.diagnosis.pros, ...item.diagnosis.cons].every((fact) => fact &&
        typeof fact.title === "string" && typeof fact.reason === "string") &&
      Array.isArray(item.diagnosis.outfits) && item.diagnosis.outfits.length === 3 &&
      item.diagnosis.outfits.every((outfit) => outfit && typeof outfit.tpo === "string" &&
        typeof outfit.styling === "string" && Array.isArray(outfit.items) &&
        outfit.items.every((outfitItem) => outfitItem && typeof outfitItem.name === "string")) &&
      item.profile && typeof item.profile === "object" &&
      typeof item.note === "string" && item.note.length <= 300);
  }

  function setStorageAlert(key, message, canRecover) {
    const isProfile = key === PROFILE_STORAGE_KEY;
    const alert = isProfile ? elements.profileStorageAlert : elements.wishlistStorageAlert;
    const text = isProfile ? elements.profileStorageMessage : elements.wishlistStorageMessage;
    const button = isProfile ? elements.recoverProfileStorage : elements.recoverWishlistStorage;
    text.textContent = message;
    button.hidden = !canRecover;
    alert.hidden = false;
  }

  function recoverStorage(key) {
    const name = key === PROFILE_STORAGE_KEY ? "프로필" : "위시리스트";
    if (!window.confirm(`손상된 ${name} 데이터를 삭제하고 새로 시작할까요?`)) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      setStorageAlert(key, `${name} 데이터를 초기화하지 못했어요. 브라우저 저장소 설정을 확인해 주세요.`, false);
      return;
    }
    if (key === PROFILE_STORAGE_KEY) {
      profileStorageBlocked = false;
      profileRecord = createDefaultProfileRecord();
      profileDraft = createDefaultProfile();
      profileDirty = false;
      elements.profileStorageAlert.hidden = true;
      renderProfilePage();
      applyProfileToDiagnosis();
      elements.profileSaveStatus.textContent = "프로필 데이터를 초기화했어요.";
    } else {
      wishlistStorageBlocked = false;
      wishlistEntries = [];
      elements.wishlistStorageAlert.hidden = true;
      renderWishlist();
      updateWishlistCount();
    }
  }

  function renderProfilePage() {
    const profile = profileDraft;
    const knownColors = new Set(Array.from(elements.savedPersonalColor.options, (option) => option.value || option.textContent));
    if (knownColors.has(profile.personalColor) && profile.personalColor !== "custom") {
      elements.savedPersonalColor.value = profile.personalColor;
      elements.customPersonalColor.hidden = true;
      elements.customPersonalColor.value = "";
    } else if (profile.personalColor !== "unknown" || profile.customPersonalColor) {
      elements.savedPersonalColor.value = "custom";
      elements.customPersonalColor.hidden = false;
      elements.customPersonalColor.value = profile.customPersonalColor || profile.personalColor;
    } else {
      elements.savedPersonalColor.value = "unknown";
      elements.customPersonalColor.hidden = true;
      elements.customPersonalColor.value = "";
    }

    PROFILE_CHOICE_GROUPS.forEach((group) => renderPreferenceChoices(group));
    renderWardrobeBuilder();
    renderWardrobeList();
    applyProfileToDiagnosis();
  }

  function renderPreferenceChoices(group) {
    const container = document.getElementById(group.elementId);
    const selected = profileDraft[group.key];
    const options = [...new Set([...group.options, ...selected])];
    container.replaceChildren();
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-tag";
      button.textContent = option;
      button.setAttribute("aria-pressed", String(selected.includes(option)));
      button.dataset.choice = option;
      container.append(button);
    });
  }

  function handlePreferenceChoiceClick(event, group) {
    const button = event.target.closest("button[data-choice]");
    if (!button) return;
    const value = button.dataset.choice;
    const selected = profileDraft[group.key];
    profileDraft[group.key] = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value].slice(0, 10);
    profileDirty = true;
    renderPreferenceChoices(group);
    showProfileDirtyStatus();
  }

  function addPreference(key, input) {
    const value = input.value.trim().slice(0, 40);
    if (!value) {
      elements.profileSaveStatus.textContent = "추가할 항목을 입력해 주세요.";
      return;
    }
    if (!profileDraft[key].includes(value)) {
      if (profileDraft[key].length >= 10) {
        elements.profileSaveStatus.textContent = "항목은 종류별로 최대 10개까지 등록할 수 있어요.";
        return;
      }
      profileDraft[key].push(value);
    }
    input.value = "";
    profileDirty = true;
    const group = PROFILE_CHOICE_GROUPS.find((item) => item.key === key);
    renderPreferenceChoices(group);
    showProfileDirtyStatus();
  }

  function handlePersonalColorChange() {
    elements.customPersonalColor.hidden = elements.savedPersonalColor.value !== "custom";
    if (elements.savedPersonalColor.value === "custom") elements.customPersonalColor.focus();
    handleProfilePageEdit();
  }

  function handleProfilePageEdit() {
    if (profileStorageBlocked) return;
    if (elements.savedPersonalColor.value === "custom") {
      profileDraft.personalColor = elements.customPersonalColor.value.trim();
      profileDraft.customPersonalColor = elements.customPersonalColor.value.trim();
    } else {
      profileDraft.personalColor = elements.savedPersonalColor.value;
      profileDraft.customPersonalColor = "";
    }
    profileDirty = true;
    showProfileDirtyStatus();
  }

  function showProfileDirtyStatus() {
    elements.profileSaveStatus.textContent = "변경사항이 있어요. 저장 버튼을 눌러야 유지돼요.";
  }

  function renderWardrobeBuilder() {
    elements.wardrobeChoiceGroups.replaceChildren();
    WARDROBE_CHOICE_GROUPS.forEach((group) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "wardrobe-choice-group";
      const legend = document.createElement("legend");
      legend.textContent = group.label;
      const choices = document.createElement("div");
      choices.className = "choice-tags";
      const savedValues = profileDraft.wardrobeBasics.map((item) => item[group.key]).filter(Boolean);
      const options = [...new Set([...group.options, ...savedValues, wardrobeBuilder[group.key]].filter(Boolean))];
      options.forEach((value) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-tag";
        button.textContent = value;
        button.dataset.choiceGroup = group.key;
        button.dataset.choice = value;
        button.setAttribute("aria-pressed", String(wardrobeBuilder[group.key] === value));
        choices.append(button);
      });

      const addRow = document.createElement("div");
      addRow.className = "tag-add-row";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 40;
      input.placeholder = `${group.label} 직접 입력`;
      input.setAttribute("aria-label", `${group.label} 직접 입력`);
      input.dataset.customChoiceInput = group.key;
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "small-action";
      addButton.textContent = "추가";
      addButton.dataset.addChoice = group.key;
      addRow.append(input, addButton);
      fieldset.append(legend, choices, addRow);
      elements.wardrobeChoiceGroups.append(fieldset);
    });
    updateWardrobePreview();
  }

  function handleWardrobeChoiceClick(event) {
    const addButton = event.target.closest("button[data-add-choice]");
    if (addButton) {
      const key = addButton.dataset.addChoice;
      const input = elements.wardrobeChoiceGroups.querySelector(`[data-custom-choice-input="${key}"]`);
      const value = input.value.trim();
      if (!value) {
        elements.profileSaveStatus.textContent = "태그를 추가하려면 내용을 입력해 주세요.";
        return;
      }
      wardrobeBuilder[key] = value;
      renderWardrobeBuilder();
      profileDirty = true;
      showProfileDirtyStatus();
      return;
    }
    const choice = event.target.closest("button[data-choice-group]");
    if (!choice) return;
    wardrobeBuilder[choice.dataset.choiceGroup] = choice.dataset.choice;
    renderWardrobeBuilder();
  }

  function updateWardrobePreview() {
    wardrobeBuilder.note = elements.wardrobeNoteInput.value.trim();
    const details = [wardrobeBuilder.color, wardrobeBuilder.fit, wardrobeBuilder.length, wardrobeBuilder.type].filter(Boolean);
    const name = wardrobeBuilder.note || details.join(" ");
    elements.wardrobePreview.textContent = name
      ? `미리보기: ${name}${details.length ? ` · ${details.join(" / ")}` : ""}`
      : "종류를 선택하고 아이템 정보를 조립해 주세요.";
    elements.saveWardrobeItem.disabled = !wardrobeBuilder.type || !name || profileStorageBlocked;
  }

  function saveWardrobeItem() {
    if (profileStorageBlocked) {
      elements.profileSaveStatus.textContent = "저장 데이터를 복구한 뒤 기본템을 추가해 주세요.";
      return;
    }
    updateWardrobePreview();
    const details = [wardrobeBuilder.color, wardrobeBuilder.fit, wardrobeBuilder.length, wardrobeBuilder.type].filter(Boolean);
    const item = {
      id: editingWardrobeId || createId("wardrobe"),
      name: (wardrobeBuilder.note || details.join(" ")).slice(0, 80),
      color: wardrobeBuilder.color,
      fit: wardrobeBuilder.fit,
      length: wardrobeBuilder.length,
      type: wardrobeBuilder.type,
      note: wardrobeBuilder.note
    };
    if (editingWardrobeId) {
      profileDraft.wardrobeBasics = profileDraft.wardrobeBasics.map((entry) => entry.id === editingWardrobeId ? item : entry);
    } else {
      if (profileDraft.wardrobeBasics.length >= 30) {
        elements.profileSaveStatus.textContent = "보유 기본템은 최대 30개까지 등록할 수 있어요.";
        return;
      }
      const duplicate = profileDraft.wardrobeBasics.some((entry) =>
        entry.name === item.name && entry.color === item.color && entry.fit === item.fit &&
        entry.length === item.length && entry.type === item.type);
      if (duplicate) {
        elements.profileSaveStatus.textContent = "같은 기본템이 이미 등록되어 있어요.";
        return;
      }
      profileDraft.wardrobeBasics.push(item);
    }
    profileDirty = true;
    resetWardrobeBuilder(false);
    renderWardrobeList();
    renderWardrobeBuilder();
    showProfileDirtyStatus();
  }

  function resetWardrobeBuilder(clearDraft) {
    if (clearDraft !== false) wardrobeBuilder = { color: "", fit: "", length: "", type: "", note: "" };
    editingWardrobeId = null;
    elements.wardrobeNoteInput.value = "";
    elements.saveWardrobeItem.textContent = "기본템 추가";
    elements.cancelWardrobeEdit.hidden = true;
    renderWardrobeBuilder();
  }

  function renderWardrobeList() {
    elements.wardrobeList.replaceChildren();
    elements.wardrobeEmpty.hidden = profileDraft.wardrobeBasics.length > 0;
    profileDraft.wardrobeBasics.forEach((item) => {
      const row = document.createElement("article");
      row.className = "wardrobe-item";
      const description = document.createElement("div");
      description.className = "wardrobe-item-copy";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const detail = document.createElement("span");
      detail.textContent = [item.color, item.fit, item.length, item.type].filter(Boolean).join(" · ");
      description.append(name, detail);
      const actions = document.createElement("div");
      actions.className = "wardrobe-item-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "quiet-button";
      edit.textContent = "수정";
      edit.dataset.wardrobeAction = "edit";
      edit.dataset.wardrobeId = item.id;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "quiet-button";
      remove.textContent = "삭제";
      remove.dataset.wardrobeAction = "delete";
      remove.dataset.wardrobeId = item.id;
      const moveUp = document.createElement("button");
      moveUp.type = "button";
      moveUp.className = "quiet-button";
      moveUp.textContent = "위로";
      moveUp.disabled = profileDraft.wardrobeBasics.indexOf(item) === 0;
      moveUp.dataset.wardrobeAction = "move-up";
      moveUp.dataset.wardrobeId = item.id;
      const moveDown = document.createElement("button");
      moveDown.type = "button";
      moveDown.className = "quiet-button";
      moveDown.textContent = "아래로";
      moveDown.disabled = profileDraft.wardrobeBasics.indexOf(item) === profileDraft.wardrobeBasics.length - 1;
      moveDown.dataset.wardrobeAction = "move-down";
      moveDown.dataset.wardrobeId = item.id;
      actions.append(moveUp, moveDown, edit, remove);
      row.append(description, actions);
      elements.wardrobeList.append(row);
    });
  }

  function handleWardrobeListAction(event) {
    const button = event.target.closest("button[data-wardrobe-action]");
    if (!button) return;
    const item = profileDraft.wardrobeBasics.find((entry) => entry.id === button.dataset.wardrobeId);
    if (!item) return;
    if (button.dataset.wardrobeAction === "delete") {
      if (!window.confirm(`'${item.name}' 기본템을 삭제할까요?`)) return;
      profileDraft.wardrobeBasics = profileDraft.wardrobeBasics.filter((entry) => entry.id !== item.id);
      if (editingWardrobeId === item.id) resetWardrobeBuilder();
    } else if (button.dataset.wardrobeAction === "move-up" || button.dataset.wardrobeAction === "move-down") {
      const index = profileDraft.wardrobeBasics.findIndex((entry) => entry.id === item.id);
      const nextIndex = index + (button.dataset.wardrobeAction === "move-up" ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= profileDraft.wardrobeBasics.length) return;
      [profileDraft.wardrobeBasics[index], profileDraft.wardrobeBasics[nextIndex]] =
        [profileDraft.wardrobeBasics[nextIndex], profileDraft.wardrobeBasics[index]];
    } else {
      editingWardrobeId = item.id;
      wardrobeBuilder = { color: item.color, fit: item.fit, length: item.length, type: item.type, note: item.note };
      elements.wardrobeNoteInput.value = item.note;
      elements.saveWardrobeItem.textContent = "수정 저장";
      elements.cancelWardrobeEdit.hidden = false;
      renderWardrobeBuilder();
    }
    profileDirty = true;
    renderWardrobeList();
    showProfileDirtyStatus();
  }

  function saveProfile(event) {
    event.preventDefault();
    if (profileStorageBlocked) {
      elements.profileSaveStatus.textContent = "손상된 프로필 데이터를 초기화한 뒤 저장해 주세요.";
      return;
    }
    const colorChoice = elements.savedPersonalColor.value;
    const customColor = elements.customPersonalColor.value.trim();
    if (colorChoice === "custom" && (!customColor || customColor.length > 60)) {
      elements.profileSaveStatus.textContent = "직접 입력한 퍼스널컬러를 1~60자로 적어 주세요.";
      return;
    }
    if (profileDraft.wardrobeBasics.length === 0) {
      elements.profileSaveStatus.textContent = "프로필을 저장하려면 보유 기본템을 한 개 이상 등록해 주세요.";
      return;
    }
    const preferenceConflicts = [
      ...profileDraft.preferredStyles.filter((value) => profileDraft.avoidedStyles.includes(value)),
      ...profileDraft.preferredFits.filter((value) => profileDraft.avoidedFits.includes(value))
    ];
    if (preferenceConflicts.length && !window.confirm(
      `선호와 기피에 함께 포함된 항목이 있어요: ${[...new Set(preferenceConflicts)].join(", ")}. 이대로 저장할까요?`
    )) return;
    const nextProfile = JSON.parse(JSON.stringify(profileDraft));
    nextProfile.personalColor = colorChoice === "custom" ? customColor : colorChoice;
    nextProfile.customPersonalColor = colorChoice === "custom" ? customColor : "";
    const nextRecord = { schemaVersion: STORAGE_SCHEMA_VERSION, profile: nextProfile };
    if (!isValidProfileRecord(nextRecord)) {
      elements.profileSaveStatus.textContent = "프로필 내용이나 기본템 정보를 확인해 주세요.";
      return;
    }
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextRecord));
    } catch {
      setStorageAlert(PROFILE_STORAGE_KEY, "프로필을 저장하지 못했어요. 브라우저 저장 공간이 부족하거나 제한되었는지 확인해 주세요.", false);
      elements.profileSaveStatus.textContent = "저장에 실패했어요. 입력 내용은 화면에 남아 있습니다.";
      return;
    }
    profileRecord = nextRecord;
    profileDraft = JSON.parse(JSON.stringify(nextProfile));
    profileDirty = false;
    elements.profileStorageAlert.hidden = true;
    elements.profileSaveStatus.textContent = "프로필과 기본템을 이 브라우저에 저장했어요.";
    applyProfileToDiagnosis();
    updateProfileAvailability();
  }

  function applyProfileToDiagnosis() {
    const profile = profileDraft;
    elements.personalColor.value = profile.personalColor === "unknown" ? "" : profile.personalColor;
    elements.preferredFits.value = profile.preferredFits.join(", ");
    elements.avoidFits.value = profile.avoidedFits.join(", ");
    elements.preferredStyles.value = profile.preferredStyles.join(", ");
    elements.avoidStyles.value = profile.avoidedStyles.join(", ");
    elements.wardrobeBasics.value = profile.wardrobeBasics.map((item) => {
      const fitAndLength = [item.fit, item.length].filter(Boolean).join(" ");
      return [item.name, item.color, fitAndLength, item.type].join(" | ");
    }).join("\n");
    updateProfileAvailability();
  }

  function saveWishlistEntry() {
    if (!latestDiagnosis || !product || !latestDiagnosisProfile) {
      elements.wishlistSaveStatus.textContent = "저장할 수 있는 진단 결과가 없어요. 먼저 진단을 완료해 주세요.";
      return;
    }
    if (wishlistStorageBlocked) {
      elements.wishlistSaveStatus.textContent = "위시리스트 데이터를 복구한 뒤 저장해 주세요.";
      return;
    }
    const signature = productSignature(product);
    const duplicate = wishlistEntries.find((item) => productSignature(item.product) === signature);
    if (duplicate) {
      if (window.confirm("같은 상품이 이미 저장되어 있어요. 기존 항목을 위시리스트에서 확인할까요?")) {
        showAppView("wishlist");
        window.setTimeout(() => {
          const existingCard = document.getElementById(`wishlist-${duplicate.id}`);
          if (existingCard) existingCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
        return;
      }
      if (!window.confirm("이 진단을 별도 항목으로 한 번 더 저장할까요?")) return;
    }

    const entry = {
      id: createId("wishlist"),
      createdAt: new Date().toISOString(),
      product: JSON.parse(JSON.stringify(product)),
      diagnosis: JSON.parse(JSON.stringify(latestDiagnosis.diagnosis)),
      profile: JSON.parse(JSON.stringify(latestDiagnosisProfile)),
      usedFallback: latestDiagnosis.usedFallback,
      note: ""
    };
    const nextEntries = [entry, ...wishlistEntries];
    if (!persistWishlist(nextEntries)) return;
    wishlistEntries = nextEntries;
    renderWishlist();
    updateWishlistCount();
    elements.wishlistSaveStatus.textContent = "진단 결과를 위시리스트에 저장했어요.";
  }

  function productSignature(item) {
    return JSON.stringify([
      String(item.category || "").trim().toLowerCase(),
      Array.isArray(item.colors) ? item.colors.map((color) => String(color).trim().toLowerCase()).sort() : [],
      String(item.fit || "").trim().toLowerCase(),
      String(item.length || "").trim().toLowerCase(),
      Array.isArray(item.seasonality) ? item.seasonality.map((value) => String(value).trim().toLowerCase()).sort() : [],
      Array.isArray(item.styles) ? item.styles.map((value) => String(value).trim().toLowerCase()).sort() : []
    ]);
  }

  function persistWishlist(entries) {
    const record = { schemaVersion: STORAGE_SCHEMA_VERSION, items: entries };
    const serialized = JSON.stringify(record);
    if (serialized.length > MAX_WISHLIST_STORAGE_CHARS) {
      elements.wishlistStatus.textContent = "위시리스트가 브라우저 저장 한도(4MB)를 넘었어요. 항목을 정리한 뒤 다시 시도해 주세요.";
      return false;
    }
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, serialized);
    } catch {
      setStorageAlert(WISHLIST_STORAGE_KEY, "위시리스트를 저장하지 못했어요. 브라우저 저장 공간이 부족하거나 제한되었는지 확인해 주세요.", false);
      elements.wishlistStatus.textContent = "저장에 실패했어요. 기존 위시리스트는 유지됩니다.";
      return false;
    }
    elements.wishlistStorageAlert.hidden = true;
    return true;
  }

  function renderWishlist() {
    const query = elements.wishlistSearch.value.trim().toLocaleLowerCase();
    const sorted = [...wishlistEntries].sort((a, b) => {
      if (elements.wishlistSort.value === "score") return b.diagnosis.score - a.diagnosis.score;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    const filtered = sorted.filter((entry) => wishlistSearchText(entry).includes(query));
    elements.wishlistList.replaceChildren();
    filtered.forEach((entry) => elements.wishlistList.append(createWishlistCard(entry)));
    elements.wishlistEmpty.hidden = wishlistEntries.length > 0;
    elements.wishlistNoResults.hidden = wishlistEntries.length === 0 || filtered.length > 0;
    elements.wishlistToolbar.hidden = false;
    // 사진 띠 라벨은 영문 표기이므로 저장 개수도 영어로 보여줍니다.
    elements.wishlistTotal.textContent = `${wishlistEntries.length} saved`;
    elements.wishlistStatus.textContent = wishlistEntries.length
      ? `${filtered.length}개 상품을 표시하고 있어요.`
      : "";
  }

  function wishlistSearchText(entry) {
    const fields = [
      entry.product.category,
      ...(Array.isArray(entry.product.colors) ? entry.product.colors : []),
      entry.product.fit,
      entry.product.length,
      ...(Array.isArray(entry.product.seasonality) ? entry.product.seasonality : []),
      ...(Array.isArray(entry.product.styles) ? entry.product.styles : []),
      entry.diagnosis.summary,
      entry.note,
      String(entry.diagnosis.score)
    ];
    return fields.filter((value) => typeof value === "string").join(" ").toLocaleLowerCase();
  }

  function createWishlistCard(entry) {
    const card = document.createElement("article");
    card.className = "wishlist-card";
    card.id = `wishlist-${entry.id}`;
    const heading = document.createElement("div");
    heading.className = "wishlist-card-heading";
    const title = document.createElement("h3");
    title.textContent = [entry.product.category, ...(entry.product.colors || [])].filter(Boolean).join(" · ") || "상품 진단";
    const score = document.createElement("strong");
    score.className = "wishlist-score";
    score.textContent = `${entry.diagnosis.score}점`;
    heading.append(title, score);

    const detail = document.createElement("p");
    detail.className = "wishlist-product-detail";
    detail.textContent = [entry.product.fit, entry.product.length, ...(entry.product.styles || [])].filter(Boolean).join(" · ");
    const summary = document.createElement("p");
    summary.className = "wishlist-summary";
    summary.textContent = entry.diagnosis.summary;
    const snapshot = document.createElement("details");
    snapshot.className = "wishlist-snapshot";
    const snapshotSummary = document.createElement("summary");
    snapshotSummary.textContent = "저장 당시 장단점과 코디 보기";
    snapshot.append(snapshotSummary);
    [["잘 맞는 점", entry.diagnosis.pros], ["냉정하게 볼 점", entry.diagnosis.cons]].forEach(([label, facts]) => {
      if (!Array.isArray(facts) || !facts.length) return;
      const group = document.createElement("div");
      group.className = "wishlist-snapshot-group";
      const groupTitle = document.createElement("strong");
      groupTitle.textContent = label;
      const list = document.createElement("ul");
      facts.forEach((fact) => {
        const row = document.createElement("li");
        row.textContent = `${fact.title}: ${fact.reason}`;
        list.append(row);
      });
      group.append(groupTitle, list);
      snapshot.append(group);
    });
    if (Array.isArray(entry.diagnosis.outfits)) {
      entry.diagnosis.outfits.forEach((outfit) => {
        const group = document.createElement("div");
        group.className = "wishlist-snapshot-group";
        const groupTitle = document.createElement("strong");
        groupTitle.textContent = `${outfit.tpo} 코디`;
        const description = document.createElement("p");
        description.textContent = `${outfit.items.map((item) => item.name).join(" · ")} — ${outfit.styling}`;
        group.append(groupTitle, description);
        snapshot.append(group);
      });
    }
    const date = document.createElement("time");
    date.className = "wishlist-date";
    date.dateTime = entry.createdAt;
    date.textContent = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(entry.createdAt));
    const profileNote = document.createElement("p");
    profileNote.className = "wishlist-profile-note";
    profileNote.textContent = "이 결과는 저장 당시의 프로필을 기준으로 해요. 현재 저장된 프로필로 다시 진단할 수 있어요.";

    const noteLabel = document.createElement("label");
    noteLabel.className = "wishlist-note-field";
    const noteTitle = document.createElement("span");
    noteTitle.textContent = "내 메모";
    const note = document.createElement("textarea");
    note.maxLength = 300;
    note.rows = 2;
    note.value = entry.note;
    note.dataset.wishlistNote = entry.id;
    noteLabel.append(noteTitle, note);

    const actions = document.createElement("div");
    actions.className = "wishlist-card-actions";
    const saveNote = document.createElement("button");
    saveNote.type = "button";
    saveNote.className = "secondary-button";
    saveNote.textContent = "메모 저장";
    saveNote.dataset.wishlistAction = "note";
    saveNote.dataset.wishlistId = entry.id;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet-button";
    remove.textContent = "삭제";
    remove.dataset.wishlistAction = "delete";
    remove.dataset.wishlistId = entry.id;
    const rediagnose = document.createElement("button");
    rediagnose.type = "button";
    rediagnose.className = "secondary-button";
    rediagnose.textContent = "현재 프로필로 다시 진단";
    rediagnose.dataset.wishlistAction = "rediagnose";
    rediagnose.dataset.wishlistId = entry.id;
    actions.append(rediagnose, saveNote, remove);
    card.append(heading, detail, summary, snapshot, date, profileNote, noteLabel, actions);
    return card;
  }

  function handleWishlistAction(event) {
    const button = event.target.closest("button[data-wishlist-action]");
    if (!button) return;
    const entry = wishlistEntries.find((item) => item.id === button.dataset.wishlistId);
    if (!entry) return;
    if (button.dataset.wishlistAction === "rediagnose") {
      product = JSON.parse(JSON.stringify(entry.product));
      analysisNotes = ["위시리스트에 저장한 상품 속성 스냅샷을 사용합니다."];
      confidenceByGroup = {};
      usedFallback = entry.usedFallback === true;
      renderProduct();
      elements.analysisSection.hidden = false;
      elements.resultsPanel.hidden = false;
      showAppView("workflow");
      applyProfileToDiagnosis();
      openDiagnosis();
      return;
    }
    if (button.dataset.wishlistAction === "delete") {
      if (!window.confirm("이 위시리스트 항목을 삭제할까요?")) return;
      const nextEntries = wishlistEntries.filter((item) => item.id !== entry.id);
      if (!persistWishlist(nextEntries)) return;
      wishlistEntries = nextEntries;
      elements.wishlistStatus.textContent = "위시리스트 항목을 삭제했어요.";
    } else {
      const input = elements.wishlistList.querySelector(`[data-wishlist-note="${entry.id}"]`);
      const note = input.value.trim();
      if (note.length > 300) {
        elements.wishlistStatus.textContent = "메모는 300자 이하로 입력해 주세요.";
        return;
      }
      const nextEntries = wishlistEntries.map((item) => item.id === entry.id ? { ...item, note } : item);
      if (!persistWishlist(nextEntries)) return;
      wishlistEntries = nextEntries;
      elements.wishlistStatus.textContent = "메모를 저장했어요.";
    }
    renderWishlist();
    updateWishlistCount();
  }

  function updateWishlistCount() {
    elements.wishlistCount.textContent = String(wishlistEntries.length);
  }

  function showAppView(view) {
    const isWorkflow = view === "workflow";
    const isProfile = view === "profile";
    elements.workflowView.hidden = !isWorkflow;
    elements.profilePage.hidden = !isProfile;
    elements.wishlistPage.hidden = view !== "wishlist";
    elements.guidePage.hidden = view !== "guide";
    [
      [elements.workflowNav, isWorkflow],
      [elements.profileNav, isProfile],
      [elements.wishlistNav, view === "wishlist"],
      [elements.guideNav, view === "guide"]
    ].forEach(([button, active]) => {
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (isProfile) renderProfilePage();
    if (view === "wishlist") renderWishlist();
    if (view === "guide") renderGuide();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ───────── 이용 가이드 ─────────
     가이드의 선택지 예시는 프로필·기본템 입력에 쓰는 실제 옵션 배열에서 만듭니다.
     옵션이 바뀌어도 가이드가 자동으로 따라가며, 설명이 없는 항목은 이름만 보여줍니다. */
  const GUIDE_FIT_DETAILS = {
    "슬림핏": { body: 16, shoulder: 16, drop: 0, text: "몸에 붙는 실루엣. 라인이 깔끔하지만 체형이 그대로 드러나요." },
    "레귤러핏": { body: 20, shoulder: 20, drop: 0, text: "가장 기본적인 여유. 어깨선이 제자리에 맞고 활동이 편해요." },
    "세미오버핏": { body: 24, shoulder: 24, drop: 3, text: "한 치수 크게 입은 듯한 여유. 어깨선이 살짝 내려와요." },
    "오버핏": { body: 28, shoulder: 28, drop: 6, text: "넉넉한 품과 떨어지는 어깨. 캐주얼·스트리트 무드가 강해요." }
  };
  // 견본 색은 이름을 이해하기 위한 대략적인 톤이며 진단 로직에는 쓰이지 않습니다.
  const GUIDE_COLOR_SWATCHES = {
    "검정": "#1c1b18", "흰색": "#ffffff", "아이보리": "#f3eddc", "베이지": "#d8c6a5", "브라운": "#7a5538",
    "회색": "#9b9a95", "네이비": "#1f2a44", "파랑": "#2f5fa8", "하늘색": "#a8c8e6", "초록": "#4f6b4a",
    "빨강": "#a8322d", "진청": "#2b3a55", "연청": "#8fa9c4"
  };
  const GUIDE_STYLE_NOTES = {
    "미니멀": "장식 없이 단정한 무채색·단색 위주",
    "클래식": "셔츠·슬랙스·트렌치처럼 오래 가는 정석 아이템",
    "캐주얼": "티셔츠·데님·스니커즈의 편안한 데일리룩",
    "페미닌": "부드러운 소재와 곡선, 여성스러운 디테일",
    "스트리트": "오버핏·그래픽·스포티 요소가 강한 룩",
    "빈티지": "워싱·레트로 컬러처럼 오래된 듯한 멋"
  };
  let guideRendered = false;

  function renderGuide() {
    if (guideRendered) return;
    const fitGroup = PROFILE_CHOICE_GROUPS.find((group) => group.key === "preferredFits");
    const styleGroup = PROFILE_CHOICE_GROUPS.find((group) => group.key === "preferredStyles");
    const wardrobeGroup = (key) => WARDROBE_CHOICE_GROUPS.find((group) => group.key === key);

    const fitList = document.querySelector("#guide-fit-list");
    fitGroup.options.forEach((name) => {
      const detail = GUIDE_FIT_DETAILS[name];
      const card = document.createElement("figure");
      card.className = "guide-fit-card";
      if (detail) card.append(createFitIllustration(detail));
      const caption = document.createElement("figcaption");
      const title = document.createElement("strong");
      title.textContent = name;
      caption.append(title);
      if (detail) {
        const text = document.createElement("span");
        text.textContent = detail.text;
        caption.append(text);
      }
      card.append(caption);
      fitList.append(card);
    });
    document.querySelector("#guide-wardrobe-fits").textContent = wardrobeGroup("fit").options.join(" · ");

    const colorList = document.querySelector("#guide-color-list");
    wardrobeGroup("color").options.forEach((name) => {
      const item = document.createElement("li");
      const swatch = document.createElement("span");
      swatch.className = "guide-swatch";
      swatch.setAttribute("aria-hidden", "true");
      if (GUIDE_COLOR_SWATCHES[name]) swatch.style.background = GUIDE_COLOR_SWATCHES[name];
      const label = document.createElement("span");
      label.textContent = name;
      item.append(swatch, label);
      colorList.append(item);
    });

    const styleList = document.querySelector("#guide-style-list");
    styleGroup.options.forEach((name) => {
      const term = document.createElement("dt");
      term.textContent = name;
      const desc = document.createElement("dd");
      desc.textContent = GUIDE_STYLE_NOTES[name] || "";
      styleList.append(term, desc);
    });

    [["type", "#guide-type-list"], ["length", "#guide-length-list"]].forEach(([key, selector]) => {
      const list = document.querySelector(selector);
      wardrobeGroup(key).options.forEach((name) => {
        const item = document.createElement("li");
        item.textContent = name;
        list.append(item);
      });
    });
    guideRendered = true;
  }

  // 핏 차이를 보여주는 단순한 티셔츠 실루엣과 몸 라인(점선)을 SVG로 그립니다.
  function createFitIllustration({ body, shoulder, drop }) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    const r = (x) => 50 + x;
    const l = (x) => 50 - x;
    const shirt = document.createElementNS(ns, "path");
    shirt.setAttribute("class", "fit-shirt");
    shirt.setAttribute("d", [
      "M42 14 Q50 22 58 14",
      `L${r(shoulder)} ${18 + drop}`, `L${r(shoulder + 12)} ${34 + drop}`, `L${r(shoulder + 6)} ${40 + drop}`,
      `L${r(body)} ${34 + drop}`, `L${r(body)} 88`, `L${l(body)} 88`, `L${l(body)} ${34 + drop}`,
      `L${l(shoulder + 6)} ${40 + drop}`, `L${l(shoulder + 12)} ${34 + drop}`, `L${l(shoulder)} ${18 + drop}`, "Z"
    ].join(" "));
    const bodyLine = document.createElementNS(ns, "path");
    bodyLine.setAttribute("class", "fit-body");
    bodyLine.setAttribute("d", "M43 16 Q34 18 33 30 L34 88 M57 16 Q66 18 67 30 L66 88");
    svg.append(shirt, bodyLine);
    return svg;
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /* ───────── 스크롤 연출 (디자인 전용) ─────────
     기능 상태와는 무관하며, 화면이 아래로 내려갈 때 섹션이 떠오르고 히어로 카드가 다른 속도로 움직입니다.
     '동작 줄이기' 설정이거나 IntersectionObserver가 없으면 아무 효과 없이 모든 요소를 그대로 보여줍니다. */
  setupScrollMotion();

  function setupScrollMotion() {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector(".site-header");

    // 상단 바: 조금이라도 스크롤하면 그림자를 줘서 콘텐츠와 구분합니다.
    const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    updateHeader();

    if (reduceMotion || !("IntersectionObserver" in window)) {
      window.addEventListener("scroll", updateHeader, { passive: true });
      return;
    }

    // 섹션 등장: 같은 부모 안의 형제 카드는 순서대로 조금씩 늦게 나타납니다.
    const revealSelectors = [
      ".feature-strip", ".feature-strip-list li", ".workspace", ".analysis-section", ".diagnosis-section",
      ".page-heading", ".profile-page-card", ".wishlist-toolbar", ".guide-steps .guide-step", ".guide-block",
      ".guide-tips", ".site-footer"
    ];
    const targets = document.querySelectorAll(revealSelectors.join(","));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach((element) => {
      const siblings = Array.from(element.parentElement.children).filter((child) => child.matches(revealSelectors.join(",")));
      const order = Math.max(0, siblings.indexOf(element));
      element.style.setProperty("--reveal-delay", `${Math.min(order, 4) * 90}ms`);
      element.classList.add("reveal");
      observer.observe(element);
    });
    document.documentElement.classList.add("has-reveal");

    // 히어로 패럴랙스: 카드마다 data-parallax 속도만큼 스크롤 거리에 비례해 위아래로 움직입니다.
    document.querySelectorAll("[data-parallax]").forEach((card) => {
      const speed = Number(card.dataset.parallax);
      if (Number.isFinite(speed)) card.style.setProperty("--speed", String(speed));
    });
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--scroll-y", String(Math.min(window.scrollY, 900)));
        updateHeader();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  }
})();
