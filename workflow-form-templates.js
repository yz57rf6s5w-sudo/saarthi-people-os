(function(){
const templates={
 onboarding:{title:'New hire onboarding',purpose:'Collect the essentials needed to prepare a smooth first week. Explain who will review each answer and use approved profile mappings only where appropriate.',fields:[['Personal email','email','',true],['Joining date','date','',true],['Work location','text','employment.location',true],['Emergency contact','text','contact.emergencyContact',false]]},
 employee_update:{title:'Employee information update',purpose:'Request a verified update to employee information. HR reviews mapped profile changes before they are applied.',fields:[['Work location','text','employment.location',true],['Emergency contact','text','contact.emergencyContact',false],['Development goal','long','development.goal',false]]},
 expenses:{title:'Expense supporting information',purpose:'Collect supporting details for an expense workflow. This demo captures information only; it does not initiate payment or approval.',fields:[['Expense date','date','',true],['Amount (INR)','number','',true],['Business purpose','long','',true],['Receipt reference','text','',false]]},
 skills:{title:'Skills and development check-in',purpose:'Capture employee-reported skills and development goals. Self-reported information is not manager-validated until separately reviewed.',fields:[['Skill or capability','text','',true],['Current experience','long','',false],['Development goal','long','development.goal',true],['Evidence reference','text','',false]]},
 equipment:{title:'Equipment and access request',purpose:'Capture the equipment or system access needed for work. Fulfilment and access grants require separate authorised review.',fields:[['Item or system','text','',true],['Business justification','long','',true],['Needed by','date','',false],['Manager / project','text','',false]]},
 feedback:{title:'Feedback and check-in',purpose:'Collect a structured check-in for a human conversation. Do not include sensitive personal or health information.',fields:[['What is going well?','long','',false],['Current blocker','long','',false],['Support needed','long','',false],['Next development goal','long','development.goal',false]]},
 offboarding:{title:'Offboarding checklist intake',purpose:'Capture operational handover information. This form does not terminate employment or revoke access; authorised people must complete those actions.',fields:[['Proposed last working day','date','',true],['Handover owner','text','',true],['Open work and handover notes','long','',true],['Equipment to return','long','',false]]},
 blank:{title:'',purpose:'',fields:[['Question','text','',true]]}
};
const original=window.saarthiFormsRender;
if(typeof original!=='function')return;
window.saarthiFormsRender=function(el,role){
 original(el,role);
 if(!['founder','hr'].includes(role))return;
 const form=el.querySelector('#wfCreate'),fieldsBox=el.querySelector('#wfFields');
 if(!form||!fieldsBox||form.querySelector('#wfTemplate'))return;
 const card=form.closest('.wf-card');
 const picker=document.createElement('div');
 picker.className='wf-field';
 picker.innerHTML='<label for="wfTemplate">Start from a workflow template</label><select id="wfTemplate"><option value="">Choose a template…</option><option value="onboarding">Onboarding</option><option value="employee_update">Employee information update</option><option value="expenses">Expense supporting information</option><option value="skills">Skills and development</option><option value="equipment">Equipment and access</option><option value="feedback">Feedback and check-in</option><option value="offboarding">Offboarding</option><option value="blank">Blank form</option></select><p class="wf-muted">Templates are editable starting points. Review every question and profile mapping before publishing.</p>';
 form.parentNode.insertBefore(picker,form);
 picker.querySelector('select').addEventListener('change',event=>{
  const selected=templates[event.target.value];if(!selected)return;
  form.querySelector('[name="title"]').value=selected.title;
  form.querySelector('[name="purpose"]').value=selected.purpose;
  while(fieldsBox.children.length>1)fieldsBox.lastElementChild.remove();
  const setField=(node,field)=>{
   node.querySelector('[name="fieldLabel"]').value=field[0];
   node.querySelector('[name="fieldType"]').value=field[1];
   node.querySelector('[name="fieldMapping"]').value=field[2];
   node.querySelector('[name="fieldRequired"]').checked=field[3];
   node.querySelector('[name="fieldOptions"]').value='';
  };
  setField(fieldsBox.firstElementChild,selected.fields[0]);
  for(const field of selected.fields.slice(1)){
   form.querySelector('#wfAddField').click();
   setField(fieldsBox.lastElementChild,field);
  }
  fieldsBox.dispatchEvent(new Event('change',{bubbles:true}));
  fieldsBox.querySelectorAll('.wf-builder-field').forEach(node=>{const select=node.querySelector('[name="fieldType"]');select.dispatchEvent(new Event('change',{bubbles:true}))});
  form.querySelector('[name="title"]').focus();
 });
};
})();