var eleInf = document.getElementById("information-overlay");
var eleTxt = document.getElementById("information-content");
var eleBut = document.getElementById("information-button");
var info_on = false;

//Create information-overlay elements and add to document
export function addInfoOverlay() {
    eleInf = document.createElement("div");
    eleInf.id = "information-overlay";
    eleInf.className = "info-container";
    document.body.appendChild(eleInf);
    eleTxt = document.createElement("p");
    eleTxt.id = "information-content";
    eleTxt.innerHTML = "Click Name for Species Explorer search of that name.";
    eleInf.appendChild(eleTxt);
    eleBut = document.createElement("button");
    eleBut.id = "information-button";
    eleBut.classList.add("btn", "btn-primary");
    eleInf.appendChild(eleBut);
}

if (eleBut) {eleBut.addEventListener("click", e => {hideInfo();})} //enable click on the optional 'OK' button on the popup
//document.addEventListener("click", e => {hideInfo();}) //clicking anywhere on the page hides the info overlay
if (eleInf) {
    //eleInf.classList.add("bubble-below");
}

export function addInfoIcon(pTag, html, addIconClass=[]) {
  const iTag = document.createElement("i");
  iTag.classList.add("fa", "fa-info-circle", "info-icon");
  if (addIconClass.length) {addIconClass.forEach(iClass => iTag.classList.add(iClass))}
  iTag.addEventListener("mouseover", e => showInfo(e, html));
  iTag.addEventListener("mouseout", e => hideInfo(html));
  iTag.addEventListener("click", e => {e.stopImmediatePropagation();})
  pTag.appendChild(iTag);
}

function showInfo(e, html=false, button=false) {
  //console.log('showInfo content:', html);
  console.log('showInfo', e);
  let xOffset = 10; let yOffset = 30;
  let iconElem = e.toElement ? e.toElement : e.srcElement;
  let iconRect = iconElem.getBoundingClientRect();
  let scrollTop = document.documentElement.scrollTop;
  eleInf.style.display = 'flex';
  eleInf.style.left = (iconRect.left-xOffset)+"px";
  eleInf.style.top = (iconRect.top+scrollTop+yOffset)+"px";
  let showRect = eleInf.getBoundingClientRect();
  //console.log('bubble.right:',showRect.right,'screen.width:',window.innerWidth,'bubble.width:',showRect.width,'bubble.left:',(iconRect.left-showRect.width)+"px")
  //console.log('info icon top', iconRect.top)
  if (showRect.right > window.innerWidth) {eleInf.style.left = (iconRect.right-showRect.width+xOffset)+"px";}
  if (!button) {eleBut.style.display = 'none'}
  if (html) {eleTxt.innerHTML = html;}
  info_on = true;
}

function hideInfo() {
  eleInf.style.display = 'none';
  info_on = false;
}

function toggleInfo(e, html=false, button=false) {
  e.stopImmediatePropagation();
  if (!button) {eleBut.style.display = 'none';}
  else {eleBut.style.display = 'block';}
  if (eleTxt) {
    if (!info_on || `${html}` != `${eleTxt.innerHTML}`) {
        showInfo(e, html, button);
    } else {
        hideInfo();
    }
  } else {console.log(`No element with id 'information-content'`);}
}
