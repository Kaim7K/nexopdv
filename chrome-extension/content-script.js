const SELECTORS = {
  productName: '#product-name, input[name="name"]',
  barcode: '#product-barcode, input[name="barcode"]',
  imageUrl: 'input[type="url"], input[name="image_url"], #image_url',
  saveButton: 'button[type="submit"]',
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function findVisibleInput(selectorList) {
  for (const selector of selectorList) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function setInputValue(input, value) {
  if (!input) return false;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function getCurrentFormProduct() {
  const nameInput = findVisibleInput([SELECTORS.productName]);
  const barcodeInput = findVisibleInput([SELECTORS.barcode]);
  const imageInput = findVisibleInput([SELECTORS.imageUrl]);
  if (!nameInput && !barcodeInput && !imageInput) return null;
  return {
    name: nameInput?.value?.trim() || '',
    barcode: barcodeInput?.value?.trim() || '',
    imageUrl: imageInput?.value?.trim() || '',
    inputs: { nameInput, barcodeInput, imageInput },
  };
}

function clickSaveButton() {
  const buttons = [...document.querySelectorAll('button')];
  const saveButton = buttons.find(button => /salvar|criar/i.test((button.textContent || '').trim()) && !button.disabled);
  if (!saveButton) return false;
  saveButton.click();
  return true;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${location.origin}/api${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Erro ao acessar a API.');
  return data;
}

async function searchFirstImage(product) {
  const params = new URLSearchParams({
    query: product.barcode || product.name || '',
    name: product.name || '',
    page: '1',
  });
  const result = await apiRequest(`/products/image-search?${params.toString()}`);
  return result?.results?.[0] || null;
}

function isImageUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

async function processCurrentProduct(options = {}) {
  const current = getCurrentFormProduct();
  if (!current) throw new Error('Abra a tela de edição do produto antes de executar a automação.');
  if (current.imageUrl) return { status: 'already_has_image' };

  const image = await searchFirstImage({ name: current.name, barcode: current.barcode });
  if (!image?.url) return { status: 'not_found' };
  if (!isImageUrl(image.url)) throw new Error('A primeira imagem encontrada não retornou uma URL válida.');

  const changed = setInputValue(current.inputs.imageInput, image.url);
  if (!changed) throw new Error('Não encontrei o campo de URL da imagem nesta tela.');

  await sleep(150);
  const saved = clickSaveButton();
  return { status: saved ? 'saved' : 'filled_not_saved', imageUrl: image.url };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'nexo:process-current-product') {
    processCurrentProduct(message.options || {})
      .then(result => sendResponse({ ok: true, result }))
      .catch(error => sendResponse({ ok: false, error: error.message || 'Falha ao processar produto.' }));
    return true;
  }
  return false;
});
