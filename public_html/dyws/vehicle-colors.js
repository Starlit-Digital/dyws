/** Named colours are saved as text; only these fixed hex values render swatches. */
export const vehicleColors=Object.freeze([
 ['Black','#17191c'],['Charcoal','#3b4148'],['Grey','#7d858d'],['Silver','#bfc5cc'],
 ['White','#fafafa'],['Pearl','#eeeae0'],['Ivory','#fff2cc'],['Cream','#f3deae'],
 ['Beige','#ccb695'],['Tan','#b58b60'],['Champagne','#d7c39b'],['Gold','#c99a32'],
 ['Bronze','#976e3c'],['Brown','#704831'],['Copper','#b86b42'],['Red','#cc3038'],
 ['Burgundy','#752438'],['Maroon','#512531'],['Orange','#e77d31'],['Yellow','#f3ce46'],
 ['Lime','#9bbf38'],['Green','#3f8b4f'],['Dark green','#214e39'],['Teal','#287e80'],
 ['Turquoise','#50b8b0'],['Blue','#326fd1'],['Navy','#21395d'],['Sky blue','#8ac5ed'],
 ['Purple','#744a9c'],['Lavender','#b7a3d6'],['Pink','#ed9abb'],['Rose','#b8667e']
].map(([name,hex])=>Object.freeze({name,hex})));
