"""Upgrade an old private config without resetting accounts or losing orders."""
import json,pathlib,sqlite3,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parents[1]
checks=0
def check(ok,message):
 global checks
 assert ok,message
 checks+=1
with tempfile.TemporaryDirectory(prefix='dyws-upgrade-') as tmp:
 p=pathlib.Path(tmp);db=sqlite3.connect(p/'orders.sqlite')
 db.execute('CREATE TABLE preserved_orders(id TEXT PRIMARY KEY,total INTEGER)');db.execute("INSERT INTO preserved_orders VALUES('example-order',1495)");db.commit();db.close()
 hash_value=subprocess.check_output(['php','-r',"echo password_hash('fixture-password-123',PASSWORD_DEFAULT);"]).decode()
 config={'tenant':'fixture','database':str(p/'orders.sqlite'),'tracking_secret':'x'*64,'manager_password_hash':'old-hash','drivers':{'fixture-driver':{'name':'Old name','password_hash':'old-driver-hash'}}}
 (p/'config.json').write_text(json.dumps(config))
 import hashlib
 legacy=p/('accounts-'+hashlib.sha256(b'fixture').hexdigest()[:16]+'.json')
 legacy.write_text(json.dumps({'manager_password_hash':hash_value,'drivers':{'fixture-driver':{'name':'Current name','password_hash':hash_value,'active':False}}}))
 (p/'settings.json').write_text('{"unchanged":true}')
 args=['php',str(root/'server/migrate-accounts.php'),str(p/'config.json')]
 result=subprocess.run(args,capture_output=True,text=True);check(result.returncode==0,result.stderr)
 saved=json.loads((p/'config.json').read_text());check('drivers' not in saved and 'manager_password_hash' not in saved,'Accounts removed from active config')
 check(saved['tracking_secret']==config['tracking_secret'],'Tracking tokens remain valid')
 check(not legacy.exists(),'Legacy account JSON archived')
 check((p/'settings.json').read_text()=='{"unchanged":true}','Site JSON stays unchanged')
 db=sqlite3.connect(p/'orders.sqlite')
 check(db.execute('SELECT total FROM preserved_orders').fetchone()[0]==1495,'Existing order data preserved')
 row=db.execute('SELECT name,password_hash,active FROM drivers').fetchone()
 check(row==('Current name',hash_value,0),'Driver name, password and inactive status preserved')
 check(db.execute('SELECT password_hash FROM admin_credentials').fetchone()[0]==hash_value,'Admin override preserved')
 backup=next((p/'account-backups').iterdir());check((backup/'accounts.json').exists() and (backup/'config.json').exists(),'Private JSON backups created')
 snapshot=sqlite3.connect(backup/'orders.sqlite');check(snapshot.execute('SELECT total FROM preserved_orders').fetchone()[0]==1495,'Consistent database backup created');snapshot.close()
 result=subprocess.run(args,capture_output=True,text=True);check(result.returncode==0,result.stderr)
 check(db.execute('SELECT count(*) FROM drivers').fetchone()[0]==1,'Repeated upgrade does not duplicate accounts');db.close()
print(f'Account upgrade: {checks} checks passed.')
