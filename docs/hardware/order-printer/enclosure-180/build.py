#!/usr/bin/env python3
"""Editable CSG design, STL/SCAD/3MF export and mechanical geometry checks.

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


def tray(front=True):
    s = box(156, 110, 4)
    s += box(3, 110, 10.02, (0, 0, 3.98))
    s += box(3, 110, 10.02, (153, 0, 3.98))
    if front:
        s += box(156, 3, 4.02, (0, 0, 3.98))
        points = [(12, 12), (144, 12), (40, 96), (116, 96), (142, 52)]
    else:
        points = [(12, 98), (144, 98), (40, 14), (116, 14), (142, 34)]
    for x, y in points:
        s -= hole(x, y, h=6)
    # Shallow identifying mark on the underside, without requiring text fonts.
    s -= box(7 if front else 14, 1.5, 0.4, (70, 50, 0))
    return s


def pod():
    # 58 x 166 exterior; 52 x 160 clear interior; floor 4, wall 3.
    s = box(58, 166, 42) - box(52, 160, 40, (3, 3, 4))
    for x in (7, 51):
        for y in (7, 159):
            s += box(10, 10, 38.02, (x - 5, y - 5, 3.98))
            s -= hole(x, y, 32, 15)
            s -= hex_pocket(x, y, 34)
            opening_y = y if y == 7 else y - 10
            s -= box(6.1, 10, P['nut_pocket_height_mm'], (x - 3.05, opening_y, 34))
    # Front panel, horizontal bore. The nut and solder lugs remain inside.
    bore = cylinder(P['button_hole_diameter_mm'], 5).rotate((90, 0, 0)).move((29, 4, 23))
    s -= bore
    # Open cable notches accept captive cables before the lid is fitted.
    s -= box(10, 5, 20, (18, 162, 26))
    s -= box(11, 5, 20, (34, 162, 26))
    # Side ventilation: small horizontal holes rather than open slots above PCB.
    for y in (82, 90, 98, 106):
        s -= cylinder(3, 5).rotate((0, 90, 0)).move((54, y, 25))
    # M3 pod joints and two outer feet.
    for x, y in [(14, 20), (14, 112), (46, 14), (46, 152)]:
        s -= hole(x, y, h=6)
    # FireBeetle, antenna end toward y=46, USB end toward y=106.
    for x in (24.7, 46.7):
        for y in (47.7, 104.3):
            s -= hole(x, y, h=6, d=P['m2_clearance_diameter_mm'])
    # Cable tie slots clear the board, mounting holes and converter carrier.
    for x, y in [(16, 155), (26, 155), (34, 134), (44, 134)]:
        s -= box(2, 5, 6, (x, y, -1))
    # Direct soldered converter pigtails avoid the overhang of right angle headers.
    s += converter_rails().rotate((0, 0, 90)).move((22, 121, -0.02))
    return s


def lid():
    s = box(58, 166, 3)
    for x in (7, 51):
        for y in (7, 159):
            s -= hole(x, y, h=5)
    return s


def join_plate():
    s = box(16, 44, 4)
    for y in (8, 36):
        s -= hole(8, y, h=6)
    return s


def foot():
    # Print with the nut pocket upward. Flip the part when assembling under tray.
    s = box(16, 16, 8) - hole(8, 8, h=10)
    return s - hex_pocket(8, 8, 5.2)


def coupon():
    s = box(80, 65, 4)
    # FireBeetle rotated 90 degrees on coupon, four actual hole centres.
    for x in (5.7, 62.3):
        for y in (5.7, 27.7):
            s -= hole(x, y, h=6, d=P['m2_clearance_diameter_mm'])
    s += box(14, 14, 14.02, (64, 7, 3.98))
    s -= hole(71, 14, h=20)
    s -= hex_pocket(71, 14, 10)
    s -= box(6.1, 10, P['nut_pocket_height_mm'], (67.95, 14, 10))
    # Match the pod's 3 mm vertical front wall and horizontal button bore.
    s += box(18, 3, 22.02, (60, 42, 3.98))
    s -= cylinder(P['button_hole_diameter_mm'], 5).rotate((90, 0, 0)).move((69, 46, 17))
    s += converter_rails((6, 43, 3.98))
    return s


PARTS = {
    'tray_front': (tray(True), 1),
    'tray_rear': (tray(False), 1),
    'electronics_pod': (pod(), 1),
    'electronics_lid': (lid(), 1),
    'join_plate': (join_plate(), 4),
    'foot': (foot(), 6),
    'fit_coupon': (coupon(), 1),
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
    a = [('tray_front', (0, 0, 0), (0, 0, 0)),
         ('tray_rear', (0, 110, 0), (0, 0, 0)),
         ('electronics_pod', (156, 32, 0), (0, 0, 0)),
         ('electronics_lid', (156, 32, 42), (0, 0, 0))]
    for x in (32, 108):
        a.append(('join_plate', (x, 88, -4), (0, 0, 0)))
    for y in (52, 144):
        a.append(('join_plate', (134, y + 8, -4), (0, 0, -90)))
    for x, y in [(12, 12), (144, 12), (12, 208), (144, 208), (202, 46), (202, 184)]:
        a.append(('foot', (x - 8, y + 8, 0), (180, 0, 0)))
    return a


def assembly_pixels():
    """Orthographic CAD render with a depth buffer, no graphics driver required."""
    from PIL import Image, ImageDraw
    from matplotlib.colors import to_rgb
    objects = []
    for name, offset, angles in assembly():
        s = PARTS[name][0].rotate(angles).move(offset)
        if name == 'electronics_lid':
            s = s.move((30, 0, 55))
        objects.append((mesh(s), '#47848a' if name in ('electronics_pod', 'electronics_lid') else '#586575'))
    objects.extend([(mesh(box(25.4, 60, 1.6, (179, 78, 10))), '#398064'),
                    (mesh(box(13.97, 25.4, 1.6, (163.63, 155, 6.18))), '#b74740')])
    camera = np.array([420., -360., 350.])
    target = np.array([110., 110., 65.])
    forward = target - camera; forward /= np.linalg.norm(forward)
    right = np.cross(forward, [0., 0., 1.]); right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    matrix = np.column_stack([right, up, forward])
    from itertools import product
    corners = np.array(list(product((5, 151), (7, 206), (7.175, 153.175))))
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
    pc = project(corners)
    for i, a in enumerate(corners):
        for j in range(i+1, len(corners)):
            if np.count_nonzero(a != corners[j]) == 1:
                draw.line([tuple(pc[i, :2]), tuple(pc[j, :2])], fill='#9ca9b2', width=2)
    return image


def render_preview():
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(14, 8), facecolor='#f5f4f0')
    ax = fig.add_subplot(121, facecolor='#f5f4f0')
    ax.imshow(assembly_pixels())
    ax.set_axis_off()
    ax.set_title('Assembled cradle, lid lifted\nGray envelope = 146 × 199 × 146 mm printer', fontsize=12)
    bx = fig.add_subplot(122, facecolor='#f5f4f0')
    bx.set_xlim(0, 180); bx.set_ylim(0, 180); bx.set_aspect('equal')
    from matplotlib.patches import Rectangle
    bx.add_patch(Rectangle((0, 0), 180, 180, fill=False, linewidth=2, color='#555'))
    bx.add_patch(Rectangle((5, 5), 170, 170, fill=False, linestyle='--', color='#aaa'))
    bx.add_patch(Rectangle((12, 35), 156, 110, facecolor='#48505b', alpha=.9))
    bx.text(90, 90, 'Largest tray half\n156 × 110 × 14 mm', color='white', ha='center', va='center', fontsize=13)
    bx.annotate('', xy=(12, 155), xytext=(168, 155), arrowprops=dict(arrowstyle='<->', color='#444'))
    bx.text(90, 158, '156 mm', ha='center')
    bx.set_xlabel('X, millimetres'); bx.set_ylabel('Y, millimetres')
    bx.set_title('180 × 180 mm print bed\nDashed line leaves 5 mm at the edge', fontsize=12)
    fig.suptitle('DYWS modular enclosure for a 180 mm printer', fontsize=19, weight='bold')
    fig.text(.5, .02, 'CAD derived prototype • Four final print plates plus a fit coupon • Physical fit still needs verification',
             ha='center', fontsize=11, color='#555')
    fig.tight_layout(rect=(0, .12, 1, .93))
    fig.savefig(ROOT / 'cad-preview.png', dpi=170, facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    report = {'units': 'mm', 'bed': P['build_volume_mm'], 'parts': {}, 'checks': {}, 'solid_volume_cm3': 0}
    modules = ['// Generated by build.py. Edit build.py and parameters.json for reproducible changes.',
               '// Each selected part is in its intended printing orientation. Millimetres.',
               'part = "assembly"; // tray_front, tray_rear, electronics_pod, electronics_lid, join_plate, foot, fit_coupon']
    for name, (shape, count) in PARTS.items():
        m = mesh(shape)
        assert shape.solid.status() == mf.Error.NoError, (name, shape.solid.status())
        assert m.is_watertight and m.is_winding_consistent and m.volume > 0, name
        assert len(shape.solid.decompose()) == 1, (name, 'disconnected bodies')
        assert np.allclose(m.bounds[0], [0, 0, 0], atol=.001), (name, m.bounds)
        assert np.all(m.extents + np.array([10, 10, 0]) <= P['build_volume_mm']), name
        path = OUT / f'{name}.stl'
        m.export(path)
        reread = trimesh.load_mesh(path, process=True)
        assert reread.is_watertight and np.allclose(reread.extents, m.extents, atol=.001)
        report['parts'][name] = {'quantity': count, 'size_mm': [round(float(x), 3) for x in m.extents],
                                 'volume_cm3': round(m.volume / 1000, 3), 'watertight': True,
                                 'one_connected_solid': True, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        if name != 'fit_coupon':
            report['solid_volume_cm3'] += m.volume / 1000 * count
        modules.append(f'module {name}() {{\n{shape.scad}\n}}\nif (part == "{name}") {name}();')
    modules.append('if (part == "assembly") {')
    for name, offset, angles in assembly():
        modules.append(f'translate({list(offset)}) rotate({list(angles)}) {name}();')
    modules.append('}')
    (ROOT / 'enclosure.scad').write_text('\n\n'.join(modules) + '\n')
    # Assembly solids must touch only at their joining surfaces, never overlap.
    assembled = [(n, PARTS[n][0].rotate(r).move(t).solid) for n, t, r in assembly()]
    for i, (n, a) in enumerate(assembled):
        for nn, b in assembled[i+1:]:
            assert (a ^ b).volume() < .01, (n, nn, 'assembly interference')
    # Printer is a clearance envelope, raised by the proposed upper rubber pads.
    printer = box(146, 199, 146, (5, 7, 7.175)).solid
    for n, a in assembled:
        assert (a ^ printer).volume() < .01, (n, 'printer envelope interference')
    # Nominal bare assemblies, plus a provisional 12 x 22 x 8 USB plug envelope.
    pcb = box(25.4, 60, 6.62, (23, 46, 10)).solid
    converter = box(13.97, 25.4, 1.6, (7.63, 123, 6.18)).solid
    usb = box(12, 22, 8, (29.7, 107.47, 10)).solid
    for label, component in [('controller', pcb), ('converter', converter), ('usb_plug_allowance', usb)]:
        assert (PARTS['electronics_pod'][0].solid ^ component).volume() < .01, label
    assert (usb ^ converter).volume() < .01
    # Fastener alignment for the four joining plates and pod lid.
    expected = {(40, 96), (40, 124), (116, 96), (116, 124),
                (142, 52), (170, 52), (142, 144), (170, 144)}
    actual = set()
    for name, offset, angles in assembly():
        if name != 'join_plate': continue
        for yy in (8, 36):
            if angles[2] == -90:
                actual.add((offset[0] + yy, offset[1] - 8))
            else:
                actual.add((offset[0] + 8, offset[1] + yy))
    assert actual == expected
    plate_sets = {
        'plate_01_front': [('tray_front', (12, 35, 0))],
        'plate_02_rear': [('tray_rear', (12, 35, 0))],
        'plate_03_pod': [('electronics_pod', (61, 7, 0))],
        'plate_04_lid_and_hardware': [('electronics_lid', (10, 7, 0))] +
            [('join_plate', (x, y, 0)) for x in (90, 120) for y in (10, 64)] +
            [('foot', (x, y, 0)) for x in (90, 120, 150) for y in (120, 150)],
        'print_first_fit_coupon': [('fit_coupon', (50, 57, 0))]
    }
    for name, placements in plate_sets.items():
        write_3mf(PLATES / f'{name}.3mf', placements)
    report['checks'] = {'stl_round_trip': True, 'each_part_fits_with_5mm_brim': True,
                        'all_plate_objects_fit_with_5mm_brim': True,
                        'assembly_has_no_solid_interference': True,
                        'printer_envelope_clear': True, 'joint_hole_centres_align': True,
                        'nominal_electronics_and_usb_envelopes_clear': True,
                        'physical_hardware_fit_tested': False, 'slicer_validated': False}
    report['assembled_footprint_mm'] = [214, 220]
    report['solid_volume_cm3'] = round(report['solid_volume_cm3'], 2)
    report['fully_solid_petg_mass_g'] = round(report['solid_volume_cm3'] * P['petg_density_g_cm3'], 1)
    report['note'] = 'Mass is a full solid geometry calculation, not sliced extrusion or measured print mass.'
    (ROOT / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
    render_preview()
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
