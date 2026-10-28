import{A11yComponent,group,typography,appearance,motion,focus,preview}from'../../shared/base.js';
class PreferencesCenter extends A11yComponent{
 static styles=new URL('./component.css',import.meta.url).href;
 render(){this.resetAll=true;this.mount('Settings','Make the page feel comfortable. Every setting is optional and stays on your device.',group('Appearance',appearance(),true)+group('Text and spacing',typography())+group('Motion and media',motion())+group('Focus and navigation',focus())+preview+'<p class="hint">Reading text contrast: <strong class="number" data-contrast-ratio></strong>. Our minimum is 5:1.</p>',{dialog:true});this.q('[data-reset]').textContent='Reset all preferences';}
 update(){const output=this.q('[data-contrast-ratio]');if(output)output.textContent=this.preferences.colors.minimum.toFixed(2)+':1';}
}
customElements.define('starlit-preferences-center',PreferencesCenter);
