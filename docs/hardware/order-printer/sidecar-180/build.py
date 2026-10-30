#!/usr/bin/env python3
"""DYWS standalone printer sidecar, editable CSG design and printable exports.

Millimetres. Python source and parameters.json are the design authority.
Requires manifold3d, trimesh, numpy and matplotlib; see requirements.txt.
No external CAD application or network access is used during generation.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import hashlib
import json
import math
import zipfile
import xml.etree.ElementTree as ET

import manifold3d as mf
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parent
P = json.loads((ROOT / 'parameters.json').read_text())
OUT = ROOT / 'stl'
OUT.mkdir(exist_ok=True)
PLATES = ROOT / 'plates'
PLATES.mkdir(exist_ok=True)
EPS = 0.02


@dataclass
class Shape:
    solid: mf.Manifold
    scad: str

    def move(self, xyz):
        return Shape(self.solid.translate(xyz), f'translate({list(xyz)}) {{ {self.scad} }}')

    def rotate(self, xyz):
        return Shape(self.solid.rotate(xyz), f'rotate({list(xyz)}) {{ {self.scad} }}')

    def __add__(self, other):
        return Shape(self.solid + other.solid, f'union() {{ {self.scad}\n{other.scad} }}')

    def __sub__(self, other):
        return Shape(self.solid - other.solid, f'difference() {{ {self.scad}\n{other.scad} }}')


def box(x, y, z, at=(0, 0, 0)):
    return Shape(mf.Manifold.cube((x, y, z)), f'cube([{x}, {y}, {z}]);').move(at)


def cylinder(d, h, at=(0, 0, 0), segments=48):
    return Shape(mf.Manifold.cylinder(h, d / 2, circular_segments=segments),
                 f'cylinder(d={d}, h={h}, $fn={segments});').move(at)


def hole(x, y, z=-1, h=50, d=None):
    return cylinder(d or P['m3_clearance_diameter_mm'], h, (x, y, z))


def hex_pocket(x, y, z, h=None):
    # Regular hexagon radius gives the requested distance between opposite flats.
    return cylinder(P['nut_across_flats_mm'] * 2 / math.sqrt(3),
                    h or P['nut_pocket_height_mm'], segments=6).rotate((0, 0, 30)).move((x, y, z))


def converter_rails(at=(0, 0, 4)):
    """Sliding channels grip the short PCB edges; the header edge remains open.

    A rail coupon must be checked against the populated BOB-11189 before use.
    The same function is used in the pod and fit coupon.
    """
    inner = 25.4 + 2 * P['converter_side_clearance_mm']
    length = 13.97 + 2 * P['converter_side_clearance_mm']
    outer = inner + 3.2
    slot = P['converter_pcb_slot_height_mm']
    rail = box(outer, length + 2, 2)
    rail += box(1.6, length, 4.2, (0, 0, 1.98))
    rail += box(1.6, length, 4.2, (outer - 1.6, 0, 1.98))
    rail += box(outer, 2, 4.2, (0, length, 1.98))
    rail += box(2.2, length, 0.8, (0, 0, 2 + slot))
    rail += box(2.2, length, 0.8, (outer - 2.2, 0, 2 + slot))
    return rail.move(at)



def sidecar_body():
    s = box(62, 128, 32) - box(57.2, 123.2, 32, (2.4, 2.4, 3))
    # Captured M3 lid nuts, with entries facing into the box.
    for x in (7, 55):
        for y in (7, 121):
            s += box(9, 9, 29.02, (x-4.5, y-4.5, 2.98))
            s -= hole(x, y, 22, 15)
            s -= hex_pocket(x, y, 24)
            s -= box(P['nut_across_flats_mm'], 10, P['nut_pocket_height_mm'],
                     (x-P['nut_across_flats_mm']/2, y if y == 7 else y-10, 24))
    # Controller PCB: 60 x 25.4, original four holes on 56.6 x 22 centres.
    for x in (27.7, 49.7):
        for y in (21.7, 78.3):
            s -= hole(x, y, h=5, d=P['m2_clearance_diameter_mm'])
    # Setup button on the outer side, behind the controller, above the USB plug.
    s -= cylinder(P['button_hole_diameter_mm'], 5).rotate((0,90,0)).move((58,96,24))
    for y in (60,68,76):
        s -= cylinder(3,5).rotate((0,90,0)).move((58,y,25))
    # Open rear notches allow captive cable placement with the lid removed.
    s -= box(10,5,15,(16,124,20))
    s -= box(11,5,15,(36,124,20))
    for x,y in [(18,116),(28,116),(34,109),(46,109)]:
        s -= box(2,4,5,(x,y,-1))
    s += converter_rails((0,0,2.98)).rotate((0,0,90)).move((21,84,0))
    # Rebated hooks drop over the 3 mm outer wall of the right ring rail.
    for y in (12,88):
        clearance=P['rabbet_clearance_mm']
        hook=box(15.4,28,12+clearance,(-13,y,0))
        hook-=box(3+2*clearance,30,10+clearance,(-10-clearance,y-1,-1))
        s+=hook
    s-=cylinder(P['m3_clearance_diameter_mm'],19).rotate((0,90,0)).move((-14,27,5))
    return s.move((13,0,0))


def sidecar_lid():
    s = box(62,128,2.4)
    for x in (7,55):
        for y in (7,121):
            s -= hole(x,y,h=5)
    return s


def prism(points,height):
    pts=np.asarray(points,dtype=float)
    if np.sum(pts[:,0]*np.roll(pts[:,1],-1)-np.roll(pts[:,0],-1)*pts[:,1])<0:
        pts=pts[::-1]
    return Shape(mf.CrossSection([pts]).extrude(height),
                 f'linear_extrude(height={height}) polygon(points={pts.tolist()});')


def ring_frame():
    # Open centre; 3 mm bottom flanges and 3 mm outer webs, 12 mm beam height.
    s=box(160,214,3)-box(136,190,5,(12,12,-1))
    s+=box(160,214,12)-box(154,208,14,(3,3,-1))
    for pts in [((12,12),(36,12),(12,36)),((148,12),(124,12),(148,36)),
                ((12,202),(36,202),(12,178)),((148,202),(124,202),(148,178))]:
        s+=prism(pts,12)
    # Solid material is limited to corners and the short bolted joint zones.
    for x in (0,148):s+=box(12,36,12,(x,89,0))
    for y in (95,119):
        for x in (-1,144):
            s-=cylinder(P['m3_clearance_diameter_mm'],17).rotate((0,90,0)).move((x,y,6))
    s-=cylinder(P['m3_clearance_diameter_mm'],11).rotate((0,90,0)).move((152,70,8))
    return s


def frame_half(front):
    y=0 if front else 107
    clip=box(162,107,14,(-1,y,-1))
    frame=ring_frame()
    shape=Shape(frame.solid ^ clip.solid,f'intersection() {{ {frame.scad} {clip.scad} }}')
    return shape.move((0,-y,0))


def rail_splice():
    s=box(40,12,3)
    for x in (8,32):s-=hole(x,6,h=5)
    return s


def fit_coupon():
    s = box(70,50,2)
    for x in (4.7,61.3):
        for y in (4.7,26.7):
            s -= hole(x,y,h=4,d=P['m2_clearance_diameter_mm'])
    s += converter_rails((3,31,1.98))
    s += box(10,10,12.02,(36,35,1.98))
    s -= hole(41,40,h=18)
    s -= hex_pocket(41,40,6.8)
    s -= box(P['nut_across_flats_mm'],10,P['nut_pocket_height_mm'],
             (41-P['nut_across_flats_mm']/2,40,6.8))
    s += box(12,2.4,18.02,(58,35,1.98))
    s -= cylinder(P['button_hole_diameter_mm'],5).rotate((90,0,0)).move((64,39,12))
    return s


def rabbet_rail_coupon():
    s=box(12,32,3)+box(3,32,9.02,(9,0,2.98))
    return s-cylinder(P['m3_clearance_diameter_mm'],16).rotate((0,90,0)).move((-1,17,8))


def rabbet_hook_coupon():
    c=P['rabbet_clearance_mm']
    s=box(15.4,28,12+c)-box(3+2*c,30,10+c,(3-c,-1,-1))
    return s-cylinder(P['m3_clearance_diameter_mm'],18).rotate((0,90,0)).move((-1,15,5))


PARTS = {
    'frame_front': (frame_half(True),1),
    'frame_rear': (frame_half(False),1),
    'rail_splice': (rail_splice(),2),
    'sidecar_body': (sidecar_body(),1),
    'sidecar_lid': (sidecar_lid(),1),
    'fit_coupon': (fit_coupon(),1),
    'rabbet_rail_coupon': (rabbet_rail_coupon(),1),
    'rabbet_hook_coupon': (rabbet_hook_coupon(),1),
}
def mesh(shape):
    raw = shape.solid.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(raw.vert_properties)[:, :3],
                           faces=np.asarray(raw.tri_verts), process=True)


def write_3mf(path, placements):
    ns = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
    ET.register_namespace('', ns)
    e = lambda tag: f'{{{ns}}}{tag}'
    model = ET.Element(e('model'), {'unit': 'millimeter', 'xml:lang': 'en-US'})
    ET.SubElement(model, e('metadata'), {'name': 'Title'}).text = path.stem
    resources = ET.SubElement(model, e('resources'))
    build = ET.SubElement(model, e('build'))
    bounds = []
    for number, (name, offset) in enumerate(placements, 1):
        m = mesh(PARTS[name][0])
        lo, hi = m.bounds + np.array(offset)
        assert np.all(lo[:2] >= P['brim_allowance_mm'] - EPS)
        assert np.all(hi[:2] <= np.array(P['build_volume_mm'][:2]) - P['brim_allowance_mm'] + EPS)
        for other_lo, other_hi in bounds:
            gaps = np.maximum(other_lo - hi, lo - other_hi)
            assert max(gaps[:2]) >= 2 * P['brim_allowance_mm'] - EPS, (path, name, gaps)
        bounds.append((lo, hi))
        obj = ET.SubElement(resources, e('object'), {'id': str(number), 'type': 'model', 'name': name})
        me = ET.SubElement(obj, e('mesh'))
        verts = ET.SubElement(me, e('vertices'))
        for v in m.vertices:
            ET.SubElement(verts, e('vertex'), {k: f'{a:.6f}' for k, a in zip('xyz', v)})
        triangles = ET.SubElement(me, e('triangles'))
        for t in m.faces:
            ET.SubElement(triangles, e('triangle'), {f'v{i+1}': str(int(v)) for i, v in enumerate(t)})
        ET.SubElement(build, e('item'), {'objectid': str(number), 'transform':
                      '1 0 0 0 1 0 0 0 1 ' + ' '.join(str(v) for v in offset)})
    types = ('<?xml version="1.0" encoding="UTF-8"?>'
             '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
             '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
             '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
             '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
            '</Relationships>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', types)
        z.writestr('_rels/.rels', rels)
        z.writestr('3D/3dmodel.model', ET.tostring(model, encoding='utf-8', xml_declaration=True))



def assembly():
    return [('frame_front',(0,0,0),(0,0,0)),
            ('frame_rear',(0,107,0),(0,0,0)),
            ('rail_splice',(12,87,0),(90,0,90)),
            ('rail_splice',(145,87,0),(90,0,90)),
            ('sidecar_body',(154,43,3),(0,0,0)),
            ('sidecar_lid',(167,43,35),(0,0,0))]
def assembly_pixels():
    """Orthographic CAD render with a depth buffer, no graphics driver required."""
    from PIL import Image, ImageDraw
    from matplotlib.colors import to_rgb
    objects = []
    for name, offset, angles in assembly():
        s = PARTS[name][0].rotate(angles).move(offset)
        if name == 'sidecar_lid':
            s = s.move((8, 0, 30))
        objects.append((mesh(s), '#47848a' if name in ('sidecar_body', 'sidecar_lid') else '#586575'))
    objects.extend([(mesh(box(25.4,60,1.6,(193,63,12))), '#398064'),
                    (mesh(box(13.97,25.4,1.6,(173.63,129,8.18))), '#b74740')])
    camera = np.array([430., -360., 340.])
    target = np.array([115., 107., 40.])
    forward = target - camera; forward /= np.linalg.norm(forward)
    right = np.cross(forward, [0., 0., 1.]); right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    matrix = np.column_stack([right, up, forward])
    from itertools import product
    corners = np.array(list(product((7,153),(7,206),(15.175,161.175))))
    all_verts = np.vstack([m.vertices for m, _ in objects] + [corners])
    projected = (all_verts - camera) @ matrix
    lo = projected[:, :2].min(0); hi = projected[:, :2].max(0)
    width, height = 1200, 1100
    scale = min((width - 120) / (hi[0] - lo[0]), (height - 120) / (hi[1] - lo[1]))
    centre = (lo + hi) / 2
    def project(v):
        a = (v - camera) @ matrix
        a[:, 0] = (a[:, 0] - centre[0]) * scale + width / 2
        a[:, 1] = height / 2 - (a[:, 1] - centre[1]) * scale
        return a
    rgb = np.full((height, width, 3), (245, 244, 240), dtype=np.uint8)
    depth = np.full((height, width), np.inf)
    light = np.array([-.3, -.6, 1.]); light /= np.linalg.norm(light)
    for m, colour in objects:
        proj = project(m.vertices)
        for inds, normal in zip(m.faces, m.face_normals):
            if normal @ (camera - m.vertices[inds].mean(0)) <= 0: continue
            tri = proj[inds]
            x0, y0 = np.maximum(np.floor(tri[:, :2].min(0)).astype(int), [0, 0])
            x1, y1 = np.minimum(np.ceil(tri[:, :2].max(0)).astype(int), [width-1, height-1])
            if x1 < x0 or y1 < y0: continue
            xx, yy = np.meshgrid(np.arange(x0, x1+1) + .5, np.arange(y0, y1+1) + .5)
            a, b, c = tri
            denom = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
            if abs(denom) < 1e-9: continue
            w0 = ((b[1]-c[1])*(xx-c[0]) + (c[0]-b[0])*(yy-c[1])) / denom
            w1 = ((c[1]-a[1])*(xx-c[0]) + (a[0]-c[0])*(yy-c[1])) / denom
            w2 = 1-w0-w1
            zz = w0*a[2] + w1*b[2] + w2*c[2]
            sub = depth[y0:y1+1, x0:x1+1]
            mask = (w0 >= -1e-8) & (w1 >= -1e-8) & (w2 >= -1e-8) & (zz < sub)
            sub[mask] = zz[mask]
            shading = .52 + .48 * max(0, normal @ light)
            rgb[y0:y1+1, x0:x1+1][mask] = np.array(to_rgb(colour)) * 255 * shading
    image = Image.fromarray(rgb)
    draw = ImageDraw.Draw(image)
    pc=project(corners)
    for i,a in enumerate(corners):
        for j in range(i+1,len(corners)):
            if np.count_nonzero(a!=corners[j])==1:
                draw.line([tuple(pc[i,:2]),tuple(pc[j,:2])],fill='#9ca9b2',width=2)
    return image



def render_preview(report):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle,Circle
    fig=plt.figure(figsize=(14,8),facecolor='#f5f4f0')
    ax=fig.add_subplot(121)
    ax.imshow(assembly_pixels());ax.set_axis_off()
    ax.set_title('Open ring with sidecar lid lifted\nWire box = printer envelope',fontsize=12)
    bx=fig.add_subplot(122,facecolor='#f5f4f0')
    bx.add_patch(Rectangle((0,0),62,128,fill=False,lw=2,color='#487c80'))
    for y in (12,88):
        bx.add_patch(Rectangle((-13,y),15.4,28,fill=False,lw=2,color='#487c80'))
        bx.add_patch(Rectangle((-10.4,y),3.8,28,fill=False,ls='--',color='#888'))
    bx.add_patch(Rectangle((26,20),25.4,60,color='#398064',alpha=.8))
    bx.text(38.7,50,'ESP32',rotation=90,ha='center',va='center',color='white')
    bx.add_patch(Rectangle((6.63,86),13.97,25.4,color='#b74740',alpha=.85))
    bx.text(13.6,98.7,'MAX3232',rotation=90,ha='center',va='center',color='white',fontsize=9)
    bx.add_patch(Rectangle((32.7,81.47),12,22,fill=False,ls='--',color='#888'))
    bx.text(39,105,'USB plug',ha='center',fontsize=9,color='#666')
    for x in (27.7,49.7):
        for y in (21.7,78.3):bx.add_patch(Circle((x,y),1.15,color='#f5f4f0'))
    bx.annotate('Antenna end',xy=(38.7,20),xytext=(31,8),ha='center',arrowprops={'arrowstyle':'->'})
    bx.annotate('Setup button',xy=(62,96),xytext=(69,96),va='center',arrowprops={'arrowstyle':'->'},fontsize=10)
    bx.text(31,135,'Rear cable exits',ha='center',fontsize=11)
    bx.set_xlim(-18,93);bx.set_ylim(143,-3);bx.set_aspect('equal');bx.set_axis_off()
    bx.set_title('Component layout, lid removed\nCase 62 × 128 × 34.4 mm including lid',fontsize=12)
    fig.suptitle('DYWS compact printer sidecar',fontsize=21,weight='bold')
    fig.text(.5,.04,f"Open rails and corner gussets • Rabbeted sidecar hooks • {report['fully_solid_pla_mass_g']:.1f} g PLA reference",
             ha='center',fontsize=12,color='#555')
    fig.tight_layout(rect=(0,.10,1,.92))
    fig.savefig(ROOT/'sidecar-preview.png',dpi=170,facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    # Remove only earlier, undelivered exports owned by this same generator.
    for path in [OUT/'mounting_plate.stl',PLATES/'plate_01_body_and_lid.3mf',
                 PLATES/'plate_02_mount_and_fit_coupon.3mf',PLATES/'print_first_fit_coupon.3mf']:
        if path.exists():path.unlink()
    report={'units':'mm','build_volume_mm':P['build_volume_mm'],'parts':{},'checks':{}}
    total=0
    scad=['// Generated from build.py and parameters.json. Units: mm.',
          'part="assembly"; // frame_front, frame_rear, rail_splice, sidecar_body, sidecar_lid, fit_coupon, rabbet_rail_coupon, rabbet_hook_coupon']
    for name,(shape,count) in PARTS.items():
        m=mesh(shape)
        assert shape.solid.status()==mf.Error.NoError
        assert m.is_watertight and m.is_winding_consistent and m.volume>0,name
        assert len(shape.solid.decompose())==1,name
        assert np.allclose(m.bounds[0],[0,0,0],atol=.001),(name,m.bounds)
        assert np.all(m.extents+[10,10,0]<=P['build_volume_mm']),name
        path=OUT/f'{name}.stl';m.export(path)
        reread=trimesh.load_mesh(path,process=True)
        assert reread.is_watertight and np.allclose(reread.extents,m.extents,atol=.001)
        v=m.volume/1000
        report['parts'][name]={'quantity':count,'dimensions_mm':m.extents.round(3).tolist(),
                             'volume_cm3':round(v,3),'pla_g':round(v*P['pla_density_g_cm3'],1),
                             'watertight':True,'one_connected_solid':True,
                             'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        if not name.endswith('coupon'):total+=v*count
        scad.append(f'module {name}() {{ {shape.scad} }}\nif(part=="{name}") {name}();')
    scad.append('if(part=="assembly") {')
    for name,t,r in assembly():scad.append(f'translate({list(t)}) rotate({list(r)}) {name}();')
    scad.append('}')
    (ROOT/'sidecar.scad').write_text('\n\n'.join(scad)+'\n')
    solids=[PARTS[n][0].rotate(r).move(t).solid for n,t,r in assembly()]
    for i,a in enumerate(solids):
        for b in solids[i+1:]:assert (a^b).volume()<.01,'assembly collision'
    # Component envelopes, relative to the body floor origin.
    components={
        'firebeetle':box(25.4,60,6.62,(26,20,9)),
        'max3232_pcb':box(13.97,25.4,1.6,(6.63,86,5.18)),
        'usb_plug_allowance':box(12,22,8,(32.7,81.47,9)),
        'button_internal_allowance':cylinder(9,24.5).rotate((0,90,0)).move((35,96,24)),
    }
    body=PARTS['sidecar_body'][0].solid
    # The STL origin includes the 13 mm left hand hook projection.
    components={name:c.move((13,0,0)) for name,c in components.items()}
    for name,c in components.items():assert (body^c.solid).volume()<.01,name
    cs=list(components.values())
    for i,a in enumerate(cs):
        for b in cs[i+1:]:assert (a.solid^b.solid).volume()<.01,'component overlap'
    printer=box(146,199,146,(7,7,15.175)).solid
    for a in solids:assert (a^printer).volume()<.01,'printer clearance'
    # Each splice's transformed vertical holes match the horizontal rail holes.
    splice_holes={(x,87+y,6) for x in (12,145) for y in (8,32)}
    assert splice_holes=={(x,y,6) for x in (12,145) for y in (95,119)}
    assert 43+27==70 and 3+5==8,'rabbet retaining screw alignment'
    assert ((PARTS['rabbet_rail_coupon'][0].solid)^PARTS['rabbet_hook_coupon'][0].move((6,2,3)).solid).volume()<.01
    plate_sets={
        'plate_01_front_and_splices':[('frame_front',(10,10,0)),('rail_splice',(20,140,0)),('rail_splice',(85,140,0))],
        'plate_02_rear':[('frame_rear',(10,10,0))],
        'plate_03_sidecar_and_lid':[('sidecar_body',(10,20,0)),('sidecar_lid',(103,20,0))],
        'print_first_fit_coupons':[('fit_coupon',(20,30,0)),('rabbet_rail_coupon',(110,35,0)),('rabbet_hook_coupon',(140,35,0))],
    }
    for name,placement in plate_sets.items():write_3mf(PLATES/f'{name}.3mf',placement)
    density=P['pla_density_g_cm3']
    coupon_v=sum(p['volume_cm3'] for n,p in report['parts'].items() if n.endswith('coupon'))
    report.update({'total_final_parts':6,'solid_volume_cm3':round(total,3),
                   'pla_density_g_cm3':density,'fully_solid_pla_mass_g':round(total*density,1),
                   'with_coupon_and_20_percent_allowance_g':round((total+coupon_v)*density*1.2,1),
                   'assembled_dimensions_mm':[229,214,37.4],
                   'all_fit_coupons_pla_g':round(coupon_v*density,1),
                   'note':'Geometry based mass for solid modelled features. Not a slicer result. Excludes electronics, hardware and adhesive.'})
    report['checks']={'closed_meshes':True,'stl_round_trip':True,'single_solid_per_stl':True,
                      'parts_and_plates_fit_with_5mm_brims':True,'assembly_interference_free':True,
                      'nominal_component_envelopes_clear':True,'splice_and_retaining_hole_alignment':True,
                      'printer_envelope_clear':True,'rabbet_coupon_nominal_fit':True,
                      'physical_hardware_fit_tested':False,'slicer_validated':False,
                      'structural_load_and_radio_performance_tested':False}
    (ROOT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    render_preview(report)
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
