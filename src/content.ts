import browser from "webextension-polyfill";
import optionsStorage from "@/options-storage";

console.log("💈 Content script loaded for", browser.runtime.getManifest().name);

async function init() {
  const options = await optionsStorage.getAll();
  const color = `rgb(${options.colorRed}, ${options.colorGreen},${options.colorBlue})`;
  const text = String(options.text);
  const notice = document.createElement("div");
  notice.innerHTML = text;
  document.body.prepend(notice);
  notice.id = "text-notice";
  notice.style.border = "2px solid " + color;
  notice.style.color = color;
}

init();
