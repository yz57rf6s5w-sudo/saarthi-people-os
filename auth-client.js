import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

(function(){
  'use strict';
  const SUPABASE_URL='https://cysgrthuejegrfgdzcpy.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_wlwWoS_9btBUI4db0ThFIw_GXsmp3LD';
  const status=document.getElementById('companyAuthStatus');
  const mode=document.getElementById('companyAuthMode');
  const nameRow=document.getElementById('companyNameRow');
  const submit=document.getElementById('companyAuthSubmit');
  const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.saarthiSupabaseClient=client;
  function setStatus(message,isError){if(status){status.textContent=message;status.style.color=isError?'#b91c1c':'#64748b';}}
  function updateMode(){const signup=mode.value==='signup';nameRow.style.display=signup?'block':'block';submit.textContent=signup?'Create account and workspace':'Sign in securely';document.getElementById('companyOrgName').required=signup;}
  mode.addEventListener('change',updateMode);updateMode();
  async function enterWorkspace(user,orgName){
    const {data:rows,error}=await client.from('memberships').select('organization_id,role').eq('user_id',user.id).limit(2);
    if(error)throw new Error('Could not verify organization membership. '+error.message);
    let membership=rows&&rows[0];
    if(!rows||rows.length===0){
      if(!orgName)throw new Error('No workspace is linked to this account yet. Enter your organization name above and sign in again to create your first workspace.');
      const {data:orgId,error:bootstrapError}=await client.rpc('bootstrap_organization',{p_name:orgName});
      if(bootstrapError)throw new Error('Workspace setup failed: '+bootstrapError.message);
      membership={organization_id:orgId,role:'founder'};
    }else if(rows.length>1){
      throw new Error('This account belongs to more than one organization. Organization switching must be configured before continuing.');
    }
    if(!['founder','hr','manager','employee'].includes(membership.role))throw new Error('Your organization role is not enabled in this prototype.');
    window.saarthiAuthUser=user;
    window.saarthiAuthenticatedLogin(user,membership);
    setStatus('');
  }
  document.getElementById('companyAuthForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const email=document.getElementById('companyAuthEmail').value.trim();
    const password=document.getElementById('companyAuthPassword').value;
    const orgName=document.getElementById('companyOrgName').value.trim();
    submit.disabled=true;setStatus(mode.value==='signup'?'Creating your secure account…':'Signing in…');
    try{
      if(mode.value==='signup'){
        if(!orgName)throw new Error('Enter your organization name to create a workspace.');
        const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:email.split('@')[0]}}});
        if(error)throw error;
        if(!data.session){setStatus('Account created. Check your email to confirm it, then return here and sign in with your organization name.');return;}
        await enterWorkspace(data.user,orgName);
      }else{
        const {data,error}=await client.auth.signInWithPassword({email,password});
        if(error)throw error;
        await enterWorkspace(data.user,orgName);
      }
    }catch(error){console.error('Saarthi company authentication:',error);setStatus(error.message||'Sign-in failed. Please try again.',true);}
    finally{submit.disabled=false;}
  });
  const logout=document.getElementById('logoutBtn');
  logout?.addEventListener('click',async()=>{try{await client.auth.signOut();}catch(error){console.error('Sign-out:',error);}window.saarthiAuthUser=null;window.saarthiAuthMode=false;const role=document.getElementById('roleSelector');if(role)role.disabled=false;});
  client.auth.getSession().then(async({data,error})=>{
    if(error||!data.session)return;
    try{await enterWorkspace(data.session.user,'');}
    catch(err){setStatus(err.message||'Your session needs organization setup.',true);}
  });
})();