var modalDiv;
var modalCap;
var modalImg;
var modalSpn;

/*
imgInfo = {
    iconSrc: inat.default_photo.medium_url,
    overSrc: inat.default_photo.medium_url,
    attrib: inat.default_photo.attribution,
    title: `${species_name} ${inat.default_photo.attribution}`
}
*/
export function showImageOverlay(imgInfo) {
    modalDiv.style.display = "block"; 
    modalImg.src = imgInfo.overSrc; 
    modalImg.alt = imgInfo.attrib; 
    modalCap.innerHTML = imgInfo.title;
}

//create DOM elements for modal image overlay (eg. shown when clicking wikiPedia image thumbnail)
export function createImageOverlay() {
    modalDiv = document.createElement("div");
    modalDiv.id = "divModal";
    modalDiv.className = "modal-image-div";
    modalDiv.onclick = function() {modalDiv.style.display = "none";}
    document.body.appendChild(modalDiv);
    
    modalSpn = document.createElement("span");
    modalSpn.className = "modal-image-close";
    modalSpn.innerHTML = "&times";
    
    modalCap = document.createElement("div");
    modalCap.id = "capModal";
    modalDiv.appendChild(modalCap);
    
    modalImg = document.createElement("img")
    modalImg.id = "imgModal";
    modalImg.className = "modal-content";
    modalDiv.appendChild(modalImg);
}